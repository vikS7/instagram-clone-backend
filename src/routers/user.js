const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const User = require("../models/user");
const auth = require("../middlewares/auth");
const Post = require("../models/post");

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({storage : storage});

router.post('/signup', async (req, res) => {
    try{
        const userObj = new User(req.body);
        await userObj.save();
        const token = await userObj.generateAuthToken();
        const user = {
            _id : userObj.id,
            username : userObj.username,
            fullname : userObj.fullname,
            avatar : "data:image/png;base64," + userObj.avatar.toString('base64')
        }
        res.status(201).send({user, token});
    }catch(e){
        res.status(400).send({error : e});
    }
})

router.post("/login", async (req, res) => {
    try{
      const userObj = await User.findByCredentials(req.body.username, req.body.password);
      const user = {
          _id : userObj.id,
          username : userObj.username,
          fullname : userObj.fullname,
          bio : userObj.bio,
          avatar : "data:image/png;base64," + userObj.avatar.toString('base64')
      }
      const token = await userObj.generateAuthToken();
      res.status(200).send({user, token});
    }catch(e){
        res.status(400).send({error : e.message});
    }
});


router.post("/user/update", auth,  upload.single('avatar'), async(req, res) => {

    try{
        const {fullname, bio} = req.body;
        if(!req.file){
            req.user.fullname = fullname;
            req.user.bio = bio;
            await req.user.save();
            const user = {
                _id : req.user.id,
                username : req.user.username,
                fullname : req.user.fullname,
                bio : req.user.bio,
                avatar : "data:image/png;base64," + req.user.avatar.toString('base64')
            }
            res.status(200).send(user);
        }else{
            const buffer = await sharp(req.file.buffer).resize({width: 250, height: 250}).png().toBuffer();
            req.user.fullname = fullname;
            req.user.bio = bio;
            req.user.avatar = buffer;
            await req.user.save();
            const user = {
                _id : req.user.id,
                username : req.user.username,
                fullname : req.user.fullname,
                bio : req.user.bio,
                avatar : "data:image/png;base64," + req.user.avatar.toString('base64')
            }
            res.status(200).send(user);
        }
        
    }catch(e){
        res.status(400).send({error : e});
    }
});

router.get("/user/me/logout", auth, async (req, res) => {
    try{
        const user = req.user;
        user.tokens = user.tokens.filter(token => {
            return token.token != req.token
        });
        await user.save();
        
        res.status(200).send();
    }catch(e){
        res.status(400).send({error : "Error"});
    }
});

router.get("/user/me/logoutall", auth, async (req, res) => {
    try{
        const user = req.user;
        user.tokens = [];
        await user.save();
        
        res.status(200).send();
    }catch(e){
        res.status(400).send({error : "Error"});
    }
});

router.get("/user/me", auth, async (req, res) => {

    try{
        const postIds = req.user.posts;
	const savedPostIds = req.user.savedPosts;
        const posts = await Post.find()
                                .where("_id")
                                .in(postIds)
                                .sort("-createdAt")
                                .lean()
                                .exec();
	const savedPosts = await Post.find()
				     .where("_id")
				     .in(savedPostIds)
     				     .sort("-createdAt")
                                     .lean().exec();	
    const followersIds = req.user.followers;
    const followingsIds = req.user.followings;
    const followers = await User.find().where("_id").in(followersIds).lean().exec();
    const followings = await User.find().where("_id").in(followingsIds).lean().exec();
        const user = {
            _id : req.user._id,
            email : req.user.email,
            fullname : req.user.fullname,
            username : req.user.username,
            bio : req.user.bio,
            postCount : req.user.postCount,
            followersCount : req.user.followersCount,
            followers : followers,
            followingCount : req.user.followingCount,
            following : followings,
            avatar :  req.user.avatar.toString('base64'),
        } 
        
        user.isMe = true;
        res.status(200).send({user : user, posts : posts, savedPosts : savedPosts});
    }catch(e){
        res.status(400).send({error : e.message});
    }
    
});


router.get("/getsuggestions", auth, async (req, res) => {
    let followings = req.user.following.map(user => user.toString());
    let users = await (await User.aggregate([{$sample: {size : 4}}])).filter(user => user._id.toString() !== req.user._id.toString());
    const suggestions = users.filter(user => !followings.includes(user._id.toString())).map(user => {
        return {
            _id : user._id,
            username : user.username,
            fullname : user.fullname,
            avatar : "data:image/png;base64," + user.avatar.toString('base64'),
        }
    });
    res.status(200).send({suggestions : suggestions});
});


router.post("/getuser", auth, async (req, res) => {
    try{
        const user = await User.findOne({username : req.body.username})
            .populate({path : 'posts', select : "files commentsCount likesCount", options: {sort : {createdAt : '-1'}}})
            .populate({path : 'savedPosts', select : "files commentsCount likesCount"})
            .populate({path : 'followers', select : "username fullname avatar"})
            .populate({path : 'following' , select : "username fullname avatar"})
            .sort("-createdAt")
            .lean()
            .exec();
        
        if(!user){
            throw new Error("No User Found");
        }

        user.isFollowing = false;
        const followers = user.followers.map(follower => follower._id.toString());

        user.followers.forEach(follower => {
            follower.isFollowing = false;
            if(req.user.following.includes(follower._id.toString())){
                follower.isFollowing = true;
            }
        });

        user.following.forEach((user) => {
            user.isFollowing = false;
            if(req.user.following.includes(user._id.toString())){
                user.isFollowing = true;
            }
        });

        if(followers.includes(req.user.id)){
            user.isFollowing = true;
        }

        user.isMe = req.user.id == user._id.toString();

        res.status(200).send({user : user});

    }catch(e){
        res.status(404).send({error : e.message});
    }
});

router.post('/user/follow', auth, async (req, res) => {
    try{
        console.log(req.body.username);
        const user = await User.findOne({username : req.body.username});

        if(!user){
            throw new Error("No user exists");
        }
        if(req.user.username === user.username){
            throw new Error("You cant  follow yourself.");
        }

        await User.findByIdAndUpdate(req.user.id, {
            $push: {following : user.id},
            $inc : {followingCount : 1}
        });

        await User.findByIdAndUpdate(user.id, {
            $push : {followers : req.user.id},
            $inc : {followersCount : 1}
        });

        res.status(200).send({success : true});

    }catch(e){
        console.log(e);
        res.status(400).send({error : e.message});
    }
});

router.post("/user/unfollow", auth, async (req, res) => {
    try{

        const user = await User.findOne({username : req.body.username});
        if(!user) {
            throw new Error("No user exists");
        }

        await User.findByIdAndUpdate(req.user.id, {
            $pull : {following : user.id},
            $inc : {followingCount : -1}
        });

        await User.findByIdAndUpdate(user.id, {
            $pull : {followers : req.user.id},
            $inc : {followersCount : -1}
        });

        res.status(200).send({success : true})
    }catch(e){
        console.log(e);
        res.status(400).send({error : e.message});
    }
});


module.exports = router;