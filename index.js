const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { exec } = require('child_process'); // Import exec from child_process
const uri = "mongodb+srv://g00406866:admin@cluster0.clqcw6z.mongodb.net/?retryWrites=true&w=majority";

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));

//uses static files from public directory
app.use(express.static('public'));

//configuring mysql database
const mysqlConnection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'proj2023',
});

mysqlConnection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL: ', err);
    return;
  }
  console.log('Connected to MySQL database');
});

//creates a new MongoClient with mongoclientOptions to set the serverApi
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    //pings to confirm the connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    //closes client when finished
    await client.close();
  }
}
run().catch(console.dir);

//routes

//welcome page that links to the stores, products and managers pages
app.get('/', (req, res) => {
  res.send(`
  <head>
    <link rel="stylesheet" type="text/css" href="/styles.css">
  </head>
    <h1>Welcome to the Home Page</h1>
    <ul>
      <li><a href="/stores">Stores</a></li>
      <li><a href="/products">Product</a></li>
      <li><a href="/managers">Managers (MongoDB)</a></li>
    </ul>
  `);
});

app.get('/stores', (req, res) => {
  //retrieves data from the store table
  const query = 'SELECT * FROM store';

  mysqlConnection.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching stores from MySQL:', err);
          res.status(500).send('Internal Server Error');
          return;
      }

      //displays store details in a table with update link
      res.send(`
          <html>
          <head>
              <link rel="stylesheet" type="text/css" href="/styles.css">
          </head>
          <body>
              <h1>Stores Page</h1>
              <!-- Home button to go back to the homepage -->
              <a href="/">Home</a>
              <table>
                  <thead>
                      <tr>
                          <th>Store ID</th>
                          <th>Location</th>
                          <th>Manager ID</th>
                          <th>Action</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${results.map(store => `
                          <tr>
                              <td>${store.sid}</td>
                              <td>${store.location}</td>
                              <td>${store.mgrid}</td>
                              <td><a href="/update-store/${store.sid}">Update</a></td>
                          </tr>
                      `).join('')}
                  </tbody>
              </table>
              <a href="/add-store">Add Store</a>
          </body>
          </html>
      `);
  });
});


  //get endpoint for updating a store
app.get('/update-store/:sid', (req, res) => {
    const storeId = req.params.sid;

    //retrieves data from a store with the given storeId
    const query = 'SELECT * FROM store WHERE sid = ?';
  
    mysqlConnection.query(query, [storeId], (err, results) => {
        if (err) {
            console.error('Error fetching store details from MySQL:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (results.length === 0) {
            res.status(404).send('Store not found');
            return;
        }

        const store = results[0];

        // displays the edit store page with the store details
        res.send(`
            <html>
            <head>
                <link rel="stylesheet" type="text/css" href="/styles.css">
            </head>
            <body>
                <h1>Edit Store Page</h1>
                <!-- Add this div to display error messages -->
<div id="error-message" style="color: red;"></div>

<!-- Form for updating the store -->
<form method="post" action="/update-store/${store.sid}" onsubmit="return validateForm()">
    <label for="location">Location:</label>
    <input type="text" id="location" name="location" value="${store.location}" required>
    <br>
    <label for="mgrid">Manager ID:</label>
    <input type="text" id="mgrid" name="mgrid" value="${store.mgrid}" required>
    <br>
    <button type="submit">Update Store</button>
</form>
                <a href="/stores">Back to Stores</a>
            </body>
            </html>
        `);
    });
});

app.post('/update-store/:sid', async (req, res) => {
    const storeId = req.params.sid;
    const { location, mgrid } = req.body;
  
    //makes sure the location and mgrid are valid
    if (!location || !mgrid || mgrid.length !== 4) {
      res.status(400).send('Manager ID must be 4 digits long');
      return;
    }
  
    try {
      //checks if the manager id exists in the mongodb
      const isExists = await isManagerIdExists(mgrid);
  
      if (!isExists) {
        res.status(400).send(`ManagerID: ${mgrid} does not exist in the MongoDB.`);
        return;
      }
  
      //updates the store with the given storeId
      const updateQuery = 'UPDATE store SET location = ?, mgrid = ? WHERE sid = ?';
  
      mysqlConnection.query(updateQuery, [location, mgrid, storeId], (err, results) => {
        if (err) {
          console.error('Error updating store in MySQL:', err);
  
          //checks for duplicate entry error
          if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).send(`Manager: ${mgrid} is already assigned to a store.`);

          } else {
            res.status(500).send('Internal Server Error');
          }
          return;
        }
  
        res.redirect('/stores'); //redirects back to the stores page after successful update
      });
    } catch (error) {
      console.error('Error checking Manager ID in MongoDB:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  //get endpoint for adding a store
app.get('/add-store', (req, res) => {
  res.send(`
      <html>
      <head>
          <link rel="stylesheet" type="text/css" href="/styles.css">
      </head>
      <body>
          <h1>Add Store Page</h1>
          <!-- Display error messages if any -->
          <div id="error-message" style="color: red;"></div>

          <!-- Form for adding a store -->
          <form method="post" action="/add-store" onsubmit="return validateStoreForm()">
              <label for="sid">Store ID:</label>
              <input type="text" id="sid" name="sid" required>
              <br>
              <label for="location">Location:</label>
              <input type="text" id="location" name="location" required>
              <br>
              <label for="mgrid">Manager ID:</label>
              <input type="text" id="mgrid" name="mgrid" required>
              <br>
              <button type="submit">Add Store</button>
          </form>

          <!-- Add home button to go back to the Stores page -->
          <br>
          <a href="/stores">Back to Stores Page</a>
      </body>
      </html>
  `);
});

//post endpoint for adding a store
app.post('/add-store', async (req, res) => {
  const { sid, location, mgrid } = req.body;

  //make sure input is 5 and 4 characters long
  if (!sid || !location || !mgrid || sid.length !== 5 || mgrid.length !== 4) {
      res.status(400).send('Store Id must be 5 characters long and Manager ID must be 4 characters long.');
      return;
  }

  try {
      //checks for manager id in mongodb
      const isExists = await isManagerIdExists(mgrid);

      if (!isExists) {
          res.status(400).send(`ManagerID: ${mgrid} does not exist in the MongoDB.`);
          return;
      }

      //inserts the store into the mysql database
      const insertQuery = 'INSERT INTO store (sid, location, mgrid) VALUES (?, ?, ?)';

      mysqlConnection.query(insertQuery, [sid, location, mgrid], (err, results) => {
          if (err) {
              console.error('Error adding store to MySQL:', err);

              //checks for duplicate entry error
              if (err.code === 'ER_DUP_ENTRY') {
                  res.status(400).send(`Store with SID: ${sid} already exists.`);
              } else {
                  res.status(500).send('Internal Server Error');
              }
              return;
          }

          res.redirect('/stores'); //redirects back to the stores page after successful addition
      });
  } catch (error) {
      console.error('Error checking Manager ID in MongoDB:', error);
      res.status(500).send('Internal Server Error');
  }
});


//get endpoint for the products page
app.get('/products', (req, res) => {
  //retrieve data from the product table
  const query = `
      SELECT ps.pid, p.productdesc, ps.sid, s.location, ps.price
      FROM product_store AS ps
      LEFT JOIN product AS p ON p.pid = ps.pid
      LEFT JOIN store AS s ON ps.sid = s.sid
      UNION
      SELECT p.pid, p.productdesc, NULL AS sid, NULL AS location, NULL AS price
      FROM product AS p
      WHERE NOT EXISTS (
        SELECT 1 FROM product_store WHERE pid = p.pid
      )
  `;

  mysqlConnection.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching products from MySQL:', err);
          res.status(500).send('Internal Server Error');
          return;
      }

      //details of all products with delete link
      res.send(`
          <html>
          <head>
              <link rel="stylesheet" type="text/css" href="/styles.css">
          </head>
          <body>
              <h1>Products Page</h1>
              <table>
                  <thead>
                      <tr>
                          <th>Product ID</th>
                          <th>Description</th>
                          <th>Store ID</th>
                          <th>Location</th>
                          <th>Price</th>
                          <th>Action</th>
                      </tr>
                  </thead>
                  <!-- Add home button to go back to the homepage -->
              <br>
              <a href="/">Home</a>
                  <tbody>
                      ${results.map(product => `
                          <tr>
                              <td>${product.pid}</td>
                              <td>${product.productdesc || 'N/A'}</td>
                              <td>${product.sid || 'N/A'}</td>
                              <td>${product.location || 'N/A'}</td>
                              <td>${product.price || 'N/A'}</td>
                              <td><a href="/delete-product/${product.pid}">Delete</a></td>
                          </tr>
                      `).join('')}
                  </tbody>
              </table>
          </body>
          </html>
      `);
  });
});

//delete endpoint for deleting a product
app.get('/delete-product/:productId', (req, res) => {
    const productId = req.params.productId;

    //deletes the product with the given productId
    const deleteQuery = 'DELETE FROM product WHERE pid = ?'; //delete from the product table

    //checks if the product is sold in any store
    mysqlConnection.query(deleteQuery, [productId], (err, results) => {
        if (err) {
            console.error('Error deleting product from MySQL:', err);
            res.status(500).send(`${productId} is currently in stores and cannot be deleted.`);
            return;
        }

        res.redirect('/products'); //redirects back to the products page after successful deletion
    });
});

//get endpoint for adding a product
app.get('/products/delete/:pid', async (req, res) => {
    const productId = req.params.pid;

    //checks if the product is sold in any store
    const checkStoresQuery = 'SELECT COUNT(*) AS storeCount FROM product_store WHERE pid = ?';
    mysqlConnection.query(checkStoresQuery, [productId], async (err, results) => {
        if (err) {
            console.error('Error checking product stores in MySQL:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        const storeCount = results[0].storeCount;

        if (storeCount > 0) {
            //if the product is sold in any store, display an error message
            res.status(400).send('Product is sold in one or more stores and cannot be deleted.');
            return;
        }

        //if the product is not sold in any store, delete the product from the product table
        const deleteQuery = 'DELETE FROM product WHERE pid = ?';

        mysqlConnection.query(deleteQuery, [productId], (deleteErr, deleteResults) => {
            if (deleteErr) {
                console.error('Error deleting product from MySQL:', deleteErr);
                res.status(500).send('Internal Server Error');
                return;
            }

            res.redirect('/products'); //redirects back to the products page after successful deletion
        });
    });
});

//get endpoint for adding a product
app.get('/managers', async (req, res) => {
  try {
      await client.connect();

      const database = client.db("DCWA"); 
      const collection = database.collection("DCWAProj");

      //retrieve data from the mongodb
      const managers = await collection.find({}).toArray();

      //details of all managers with add link
      res.send(`
          <html>
          <head>
              <link rel="stylesheet" type="text/css" href="/styles.css">
          </head>
          <body>
              <h1>Managers (MongoDB) Page</h1>
              <table>
                  <thead>
                      <tr>
                          <th>Manager ID</th>
                          <th>Name</th>
                          <th>Salary</th>
                      </tr>
                  </thead>
                  <!-- Add home button to go back to the homepage -->
              <br>
              <a href="/">Home</a>
                  <tbody>
                      ${managers.map(manager => `
                          <tr>
                              <td>${manager._id}</td>
                              <td>${manager.name}</td>
                              <td>${manager.salary}</td>
                          </tr>
                      `).join('')}
                  </tbody>
              </table>
              <a href="/add-manager">Add Manager (MongoDB)</a>
          </body>
          </html>
      `);
  } catch (error) {
      console.error('Error fetching managers from MongoDB:', error);
      res.status(500).send('Internal Server Error');
  } finally {
      await client.close();
  }
});

//get endpoint for adding a manager
app.get('/add-manager', (req, res) => {
    res.send(`
        <html>
        <head>
            <link rel="stylesheet" type="text/css" href="/styles.css">
        </head>
        <body>
            <h1>Add Manager (MongoDB) Page</h1>
            <!-- Display error messages if any -->
            <div id="error-message" style="color: red;"></div>

            <!-- Form for adding a manager -->
            <form method="post" action="/managers/add" onsubmit="return validateManagerForm()">
                <label for="managerId">Manager ID:</label>
                <input type="text" id="managerId" name="managerId" required>
                <br>
                <label for="name">Name:</label>
                <input type="text" id="name" name="name" required>
                <br>
                <label for="salary">Salary:</label>
                <input type="number" id="salary" name="salary" required>
                <br>
                <button type="submit">Add Manager</button>
            </form>

            <!-- Add home button to go back to the Managers (MongoDB) page -->
            <br>
            <a href="/managers">Back to Managers (MongoDB) Page</a>
        </body>
        </html>
    `);
});

//post endpoint for adding a manager
app.post('/managers/add', async (req, res) => {
    const { managerId, name, salary } = req.body;

    //if the managerId, name or salary is invalid, display an error message
    if (!isValidManagerId(managerId) || !isValidName(name) || !isValidSalary(salary)) {
        res.status(400).send('Invalid input. Please check the provided values.');
        return;
    }

    try {
        await client.connect();

        const database = client.db("DCWA");
        const collection = database.collection("DCWAProj");

        //checks if the managerId already exists in MongoDB
        const isUniqueManagerId = await collection.findOne({ _id: managerId });

        if (isUniqueManagerId) {
            res.status(400).send('Manager ID must be unique.');
            return;
        }

        //adds the manager to MongoDB
        await collection.insertOne({
            _id: managerId,
            name: name,
            salary: parseInt(salary)
        });

        res.redirect('/managers'); //redirects back to the Managers page after successful addition
    } catch (error) {
        console.error('Error adding manager to MongoDB:', error);
        res.status(500).send('Internal Server Error');
    } finally {
        await client.close();
    }
});

//checks if the managerId is valid
function isValidManagerId(managerId) {
    return managerId && managerId.length === 4;
}
//checks if the name is valid
function isValidName(name) {
    return name && name.length > 5;
}
//checks if the salary is valid
function isValidSalary(salary) {
    return salary && !isNaN(salary) && salary >= 30000 && salary <= 70000;
}


//function that checks if the managerId exists in MongoDB
async function isManagerIdExists(managerId) {
    try {
        await client.connect();

        const database = client.db("DCWA");
        const collection = database.collection("DCWAProj");

        const manager = await collection.findOne({ _id: managerId });

        return !!manager;//returns true if manager exists, false otherwise
    } finally {
        await client.close();
    }
}

//starts the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);

  //opens the browser when the server starts
  exec(`start http://localhost:${PORT}`);
});
