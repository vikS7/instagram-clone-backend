const mongoose = require("mongoose");

const postSchema = mongoose.Schema({
    user : {
        type : mongoose.Schema.ObjectId,
        ref : "User",
        required : true,
    },
    caption : {
        type : String,
        required : true,
        trim : true,
    },
    files : {
        type : Buffer,
        required : true,
    },
    likes : [{
        type : mongoose.Schema.ObjectId, ref : "User"
    }],
    likesCount : {
        type : Number,
        default : 0,
    },
    comments : [{
        type : mongoose.Schema.ObjectId, ref : "Comment"
    }],
    commentsCount : {
        type : Number,
        default : 0,
    },
    createdAt: {
	type : Date,
	default : Date.now,
	}
})

const Post = mongoose.model("Post", postSchema);

module.exports = Post;