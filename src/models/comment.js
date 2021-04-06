const mongoose = require("mongoose");

const commentSchema = mongoose.Schema({
    user : {
        type : mongoose.Schema.ObjectId,
        ref : "User",
        required : true,
    },
    post : {
        type : mongoose.Schema.ObjectId,
        ref : "Post"
    },
    text : {
        type : String,
        required : true,
        trim : true,
    },
    createdAt : {
        type : Date,
        default : Date.now,
    }
});

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;