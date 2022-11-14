const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const db = new sqlite3.Database("./banking_database.db", (err) => {
  if (err) {
    console.error("Error opening database " + err.message);
  } else {
    db.run(
      "CREATE TABLE bank_accounts( \
            user_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,\
            last_name NVARCHAR(20)  NOT NULL,\
            first_name NVARCHAR(20)  NOT NULL,\
            password NVARCHAR(20) NOT NULL,\
            title NVARCHAR(20),\
            address NVARCHAR(100),\
            balance INTEGER default 0\
        )",
      (err) => {
        if (err) {
          console.log("Table already exists.");
        }
      }
    );
  }
});

module.exports = function (app) {
  app.get("/users", authenticateToken, getUserDetails, (req, res, next) => {
    let rows = req.rows;
    return res.json(rows.filter((row) => row.first_name === req.user.name));
  });

  app.post("/user/signup/", async (req, res, next) => {
    try {
      var reqBody = req.body;
      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(reqBody.password, salt);
      db.run(
        `INSERT INTO bank_accounts (last_name, first_name, password ,title, address) VALUES (?,?,?,?,?)`,
        [
          reqBody.last_name,
          reqBody.first_name,
          hashPassword,
          reqBody.title,
          reqBody.address,
        ],
        function (err, result) {
          if (err) {
            res.status(400).json({ error: err.message });
            return;
          }
          res.status(201).json({
            employee_id: this.lastID,
          });
        }
      );
    } catch (error) {
      res.status(500).send();
      next(error);
    }
  });

  app.post("/user/login", (req, res) => {
    //Authenticate user
    const username = req.body.username;
    // var query ="SELECT * FROM bank_accounts  where first_name = '" + req.body.username + "'";

    db.all(
      `SELECT * FROM bank_accounts  where first_name =?`,
      [username],
      async (err, rows) => {
        if (err) {
          res.status(400).json({ error: err.message });
          return;
        }

        //meaning there is user present but we need to validate the password
        var password = rows[0].password;

        let passwordValid = await bcrypt.compare(req.body.password, password);

        if (passwordValid) {
          const user = { name: username };
          const accestoken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);
          res.json({ accestoken: accestoken });
        } else {
          res.status(403).send("User and Password combination not valid");
        }
      }
    );
  });

  app.post("/deposit", authenticateToken, getUserDetails, (req, res, next) => {
    /**
     * @parmas 
     * receiver account id
     * deposit amount
 
 */
    let rows = req.rows;
    let userObject = rows.find((row) => row.user_id === req.body.user_id);

    try {
      let amount = req.body.amount;
      let new_balance = amount + userObject.balance;

      let data = [new_balance, userObject.user_id];
      let sql = `UPDATE BANK_ACCOUNTS SET BALANCE= ? WHERE USER_ID=?`;
      db.run(sql, data, function (err) {
        if (err) {
          return console.error(err.message);
        }
        console.log(`Row(s) updated: ${this.changes}`);
      });
      res.status(200).json({ total_amount: new_balance });
    } catch (error) {
      res.status(500).send();
      next(error);
    }
  });

  app.post(
    "/withdrawl",
    authenticateToken,
    getUserDetails,
    (req, res, next) => {
      /**
       * @params user_id and withdrawl amount
       * 1. check if the user amount is less than the available balance
       * 2. Display the transaction status and available balance once done
       */

      let rows = req.rows;
      let userObject = rows.find((row) => row.user_id === req.body.user_id);

      try {
        let amount = req.body.amount;
        if (userObject.balance < amount) {
          res.status(403).json({ error: "Not enough balance for withdrawl" });
          return;
        }
        let new_balance = userObject.balance - amount;

        let data = [new_balance, userObject.user_id];
        let sql = `UPDATE BANK_ACCOUNTS SET BALANCE= ? WHERE USER_ID=?`;
        db.run(sql, data, function (err) {
          if (err) {
            return console.error(err.message);
          }
          console.log(`Row(s) updated: ${this.changes}`);
        });
        res.status(200).json({ total_amount: new_balance });
      } catch (error) {
        res.status(500).send();
        next(error);
      }
    }
  );

  function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    console.log(token);
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        res.status(403).json({ error: err.message });
        return;
      }

      console.log("verified user", user);
      req.user = user;
      next();
    });
  }

  function getUserDetails(req, res, next) {
    db.all("SELECT * FROM bank_accounts", [], (err, rows) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      req.rows = rows;
      next();
    });
  }
};
