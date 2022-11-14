require("dotenv").config();
const express = require("express");
var app = express();
app.use(express.json());
require("./route")(app);

const HTTP_PORT = 8000;
app.listen(HTTP_PORT, () => {
  console.log("Server is listening on port " + HTTP_PORT);
});
