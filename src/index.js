const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");
const userRouter = require("./routers/user");
const postRouter = require("./routers/post");
const app = express();

mongoose.connect(process.env.DB_URL, {
    useNewUrlParser : true,
    useUnifiedTopology : true,
    useCreateIndex : true,
    useFindAndModify : false,
});

const port = process.env.PORT;

app.use(express.json());
app.use(morgan("combined"));
app.use(cors({origin: true}));
app.use(userRouter);
app.use(postRouter);

app.listen(port, (req, res) => {
    console.log("server is running at port : " + port);
})