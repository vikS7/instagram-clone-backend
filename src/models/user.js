const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const fs = require("fs");


let defaultAvatar = fs.readFileSync("./public/default.png", (err, data) => {
    if(err) throw err;
    return Buffer.from(data.toString('base64'));
});


const userSchema = new mongoose.Schema({
    fullname : {
        type: String,
        required : true,
        trim : true,
    },
    email : {
        type : String,
        required : true,
        trim : true,
        lowercase : true,
        unique : true,
    },
    username : {
        type : String,
        required : true,
        trim : true,
        unique :true,
    },
    password : {
        type : String,
        required : true,
        minLength : 4,
    },
    avatar : {
        type : Buffer,
        default : defaultAvatar
    },
    bio : {
        type : String,
        trim : true,
    },
    isPublic : {
        type : Boolean,
        default : true,
    },
    followers : [{type : mongoose.Schema.ObjectId, ref : "User"}],
    following : [{type : mongoose.Schema.ObjectId, ref : "User"}],
    followersCount : {
        type : Number,
        default : 0
    },
    followingCount : {
        type : Number,
        default : 0
    },
    posts : [
        {
            type : mongoose.Schema.ObjectId, ref : "Post"
        }
    ],
    postCount : {
        type : Number,
        default : 0
    },
    savedPosts : [
        {
            type : mongoose.Schema.ObjectId, ref: "Post"
        }
    ],
    createdAt : {
        type : Date,
        default : Date.now
    },
    tokens: [{
        token : {
            type : String,
            required : true
        }
    }
    ]
});


userSchema.methods.toJSON = function() {
    const user = this;
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.tokens;
    
    return userObj;
}

userSchema.methods.generateAuthToken = async function(){
    const user = this;
    const token = jwt.sign({
        id : user._id.toString()
    }, process.env.JWT_KEY);
    user.tokens = user.tokens.concat({
        token
    });
    await user.save();

    return token;
}

userSchema.statics.findByCredentials = async  (username, password) => {
    const user = await User.findOne({username});

    if(!user){
        throw new Error("Invalid Username");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if(!isMatch){
        throw new Error("Incorrect Password");
    }

    return user;
}


userSchema.pre("save", async function(next){
    const user = this;
    if(user.isModified('password')){
        user.password = await bcrypt.hash(user.password, 8);
    }
    
    next();
})


const User = mongoose.model("User", userSchema);

module.exports = User;