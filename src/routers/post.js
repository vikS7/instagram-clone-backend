const express = require("express");
const multer = require("multer");
const Post = require("../models/post");
const User = require("../models/user");
const Comment = require("../models/comment");
const auth = require("../middlewares/auth");
const sharp = require("sharp");

const storage = multer.memoryStorage();
const upload = multer({storage : storage});

const router = express.Router();

//explore page
router.get("/posts", auth, async (req, res) => {
    try{
        const userObj = await User.find({isPublic : true});
        const users = userObj.filter(user => user._id.toString() !== req.user.id);
        const postIds = users.map(user => user.posts).flat();
        const posts = await Post.find()
                                .populate({path : 'user', select : "username avatar"})
                                .sort("-createdAt")
                                .where("_id")
                                .in(postIds)
                                .lean()
                                .exec();
        
        const post = posts.map(element => {
            return {
                _id : element._id,
                files : element.files.toString('base64'),
                likesCount : element.likesCount,
                commentsCount : element.commentsCount,
            }
        })
        res.status(200).send({posts : post});
    }catch(e){
        res.status(400).send({error : e.message});
    }
});


router.get("/feed", auth, async (req, res) => {
    try{
        const following  = req.user.following;

        const users = await User.find().where("_id").in(following.concat([req.user.id])).exec();

        const postIds = users.map(user => user.posts).flat();
        const posts = await Post.find()
                                .populate({ path : "user", select : "avatar fullname username"})
                                .sort('-createdAt')
                                .where("_id")
                                .in(postIds)
                                .lean()
                                .exec();

        posts.forEach(post => {
            post.isLiked = false;
            const likes = post.likes.map(like => like.toString());
            if(likes.includes(req.user.id)){
                post.isLiked = true;
            }

            post.isSaved = false;
            const saved = req.user.savedPosts.map(posts => posts.toString());
            if(saved.includes(post._id)){
                post.isSaved = true;
            }
        })
	
        res.status(200).send({posts : posts});
    }catch(e){
	console.log(e.message);
        res.status(400).send({error : e.message});
    }
});

router.get("/getpost/:id", auth, async (req, res) => {
    try{

        const post = await Post.findById(req.params.id)
                                .populate({path : "user", select : "username avatar"})
                                .lean()
                                .exec();

        if(!post){
            throw new Error("No post found");
        }                        
        post.isFollowing = req.user.following.includes(post.user._id.toString());
	    post.isMine = req.user.id === post.user._id.toString();
        
        const likes = post.likes.map(like => like.toString());
        post.isLiked = likes.includes(req.user.id);

        post.isSaved = req.user.savedPosts.map(post => post.toString()).includes(post._id.toString());

        const comments = await Comment.find()
                                    .populate({path : "user", select: "username avatar"})
                                    .where("post").equals(post._id)
                                    .sort("-createdAt")
                                    .exec();
                        
        res.status(200).send({post : post, comments : comments});

    }catch(e){
        console.log(e);
        res.status(400).send({error : e.message});
    }
});


router.post("/addpost", auth, upload.single('post'), async(req, res) => {
    try{
        const {caption} = req.body;
        const buffer = await sharp(req.file.buffer).png({quality : 80}).toBuffer();
        const post = new Post({
            files : buffer,
            user : req.user.id,
            caption,
        });
        await post.save();
        
        await User.findByIdAndUpdate(req.user.id, {
            $push : {posts : post.id},
            $inc : {postCount : 1}
        });

        res.status(200).send();

    }catch(e){
        console.log(e.message);
        res.status(400).send({error : e.message});
    }
});


router.get("/post/togglelike/:id", auth, async (req, res) => {
    try{

        const post = await Post.findById(req.params.id);

        if(!post){
            throw new Error("No post found");
        }
        const isLiked = post.likes.includes(req.user._id);
        if(isLiked){
            post.likes.pull(req.user.id);
            post.likesCount = post.likesCount - 1;
        }else{
            post.likes.push(req.user.id);
            post.likesCount = post.likesCount + 1;
        }
        await post.save();

        res.status(200).send({success : true});

    }catch(e){
        res.status(400).send({error : e.message});
    }
});


router.get("/savepost/:id", auth, async (req, res) => {
    try{
        const post = await Post.findById(req.params.id);
        if(!post){
            throw new Error("No post found");
        }
	    const isSaved = req.user.savedPosts.includes(post.id);
    	if(!isSaved){
            await User.findByIdAndUpdate(req.user.id), {
                $push : {savedPosts : post.id},
            };
        }else{
            await User.findByIdAndUpdate(req.user.id), {
                $pull : {savedPosts : post.id}
            }
        }

        res.status(200).send({success : true});
    }catch(e){
        res.status(400).send({error : e.message});
    }
});


router.post("/addcomment", auth, async (req, res) => {
    try{
        const post = await Post.findById(req.body.id);
        if(!post){
            throw new Error("No such post found");
        }

        let comment = new  Comment({
            user : req.user.id,
            post : post.id,
            text : req.body.comment,
        }); 

        await comment.save();

        post.comments.push(comment._id);
        post.commentsCount = post.commentsCount + 1;
        await post.save();

        const comments = await Comment.find()
                                    .populate({path : "user", select: "username avatar"})
                                    .where("post").equals(post._id)
                                    .sort("-createdAt")
                                    .exec();

        res.status(200).send({comment : comments});

    }catch(e){
        res.status(400).send({error : e.message});
    }
});


router.delete("/post/delete/:id", auth, async (req, res) => {
    try{
        
        const post = await Post.findById(req.params.id);

        req.user.posts = req.user.posts.filter(element => element !== post.id);
        req.user.postCount = req.user.postCount - 1;
        
        await req.user.save();
        await post.remove();
        res.status(200).send({status : true});
    }catch(e){
        res.status(400).send({error: e.message});
    }
});

module.exports = router;