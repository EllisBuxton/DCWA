const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://g00406866:admin@cluster0.clqcw6z.mongodb.net/?retryWrites=true&w=majority";

const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));

// Serve static files from the 'public' directory
app.use(express.static('public'));

// MySQL Database Configuration
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

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

// ExpressJS Routes

// Home Page with links to Stores, Products, and Managers (MongoDB)
app.get('/', (req, res) => {
  res.send(`
    <h1>Welcome to the Home Page</h1>
    <ul>
      <li><a href="/stores">Stores</a></li>
      <li><a href="/products">Product</a></li>
      <li><a href="/managers">Managers (MongoDB)</a></li>
    </ul>
  `);
});

// GET endpoint for the Stores page
app.get('/stores', (req, res) => {
    // Query to retrieve details of all stores from the MySQL database
    const query = 'SELECT * FROM store';
  
    mysqlConnection.query(query, (err, results) => {
      if (err) {
        console.error('Error fetching stores from MySQL:', err);
        res.status(500).send('Internal Server Error');
        return;
      }
  
      // Display the details of all stores with a link to the external CSS file
      res.send(`
        <html>
        <head>
          <link rel="stylesheet" type="text/css" href="/styles.css">
        </head>
        <body>
          <h1>Stores Page</h1>
          <ul>
            ${results.map(store => `
              <li>
                SID: ${store.sid}, 
                Location: ${store.location}, 
                Manager ID: ${store.mgrid},
                <a href="/update-store/${store.sid}">Update</a>
              </li>
            `).join('')}
          </ul>
          <a href="/add-store">Add Store</a>
          
          <!-- Add home button to go back to the homepage -->
          <br>
          <a href="/">Home</a>
        </body>
        </html>
      `);
    });
});

  // Change the GET endpoint for the edit store page
app.get('/update-store/:sid', (req, res) => {
    const storeId = req.params.sid;

    // Query to retrieve details of a specific store from the MySQL database
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

        // Render the edit store page with the store details
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
  
    // Validate input
    if (!location || !mgrid || mgrid.length !== 4) {
      res.status(400).send('Manager ID must be 4 digits long');
      return;
    }
  
    try {
      // Check if Manager ID exists in MongoDB
      const isExists = await isManagerIdExists(mgrid);
  
      if (!isExists) {
        res.status(400).send(`ManagerID: ${mgrid} does not exist in the MongoDB.`);
        return;
      }
  
      // Query to update the store in the MySQL database
      const updateQuery = 'UPDATE store SET location = ?, mgrid = ? WHERE sid = ?';
  
      mysqlConnection.query(updateQuery, [location, mgrid, storeId], (err, results) => {
        if (err) {
          console.error('Error updating store in MySQL:', err);
  
          // Check for the specific error code indicating a duplicate entry
          if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).send(`Manager: ${mgrid} is already assigned to a store.`);

          } else {
            res.status(500).send('Internal Server Error');
          }
          return;
        }
  
        res.redirect('/stores'); // Redirect back to the stores page after updating
      });
    } catch (error) {
      console.error('Error checking Manager ID in MongoDB:', error);
      res.status(500).send('Internal Server Error');
    }
  });

// GET endpoint for the Products page
app.get('/products', (req, res) => {
    // Query to retrieve details of all products from the MySQL database
    const query = `
        SELECT p.pid, p.productdesc, ps.sid, s.location, ps.price
        FROM product AS p
        JOIN product_store AS ps ON p.pid = ps.pid
        JOIN store AS s ON ps.sid = s.sid
    `;

    mysqlConnection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching products from MySQL:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        // Display the details of all products with delete action and a link to the external CSS file
        res.send(`
            <html>
            <head>
                <link rel="stylesheet" type="text/css" href="/styles.css">
            </head>
            <body>
                <h1>Products Page</h1>
                <ul>
                    ${results.map(product => `
                        <li>
                            Product ID: ${product.pid}, <!-- Change productid to pid -->
                            Description: ${product.productdesc}, <!-- Change description to productdesc -->
                            Store ID: ${product.sid},
                            Location: ${product.location},
                            Price: ${product.price},
                            <a href="/delete-product/${product.pid}">Delete</a> <!-- Change productid to pid -->
                        </li>
                    `).join('')}
                </ul>
                <!-- Add home button to go back to the homepage -->
                <br>
                <a href="/">Home</a>
            </body>
            </html>
        `);
    });
});

// DELETE endpoint for deleting a product
app.get('/delete-product/:productId', (req, res) => {
    const productId = req.params.productId;

    // Query to delete the product from the MySQL database
    const deleteQuery = 'DELETE FROM product WHERE pid = ?'; // Change productid to pid

    mysqlConnection.query(deleteQuery, [productId], (err, results) => {
        if (err) {
            console.error('Error deleting product from MySQL:', err);
            res.status(500).send(`${productId} is currently in stores and cannot be deleted.`);
            return;
        }

        res.redirect('/products'); // Redirect back to the products page after deleting
    });
});

// GET endpoint for deleting a product
app.get('/products/delete/:pid', async (req, res) => {
    const productId = req.params.pid;

    // Check if the product is sold in any store
    const checkStoresQuery = 'SELECT COUNT(*) AS storeCount FROM product_store WHERE pid = ?';
    mysqlConnection.query(checkStoresQuery, [productId], async (err, results) => {
        if (err) {
            console.error('Error checking product stores in MySQL:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        const storeCount = results[0].storeCount;

        if (storeCount > 0) {
            // Product is sold in one or more stores, cannot be deleted
            res.status(400).send('Product is sold in one or more stores and cannot be deleted.');
            return;
        }

        // Product is not sold in any store, proceed with deletion
        const deleteQuery = 'DELETE FROM product WHERE pid = ?';

        mysqlConnection.query(deleteQuery, [productId], (deleteErr, deleteResults) => {
            if (deleteErr) {
                console.error('Error deleting product from MySQL:', deleteErr);
                res.status(500).send('Internal Server Error');
                return;
            }

            res.redirect('/products'); // Redirect back to the products page after successful deletion
        });
    });
});

// GET endpoint for the Managers (MongoDB) page
app.get('/managers', async (req, res) => {
    try {
        await client.connect();

        const database = client.db("DCWA"); // Replace with your actual MongoDB database name
        const collection = database.collection("DCWAProj"); // Replace with your actual MongoDB collection name

        // Query to retrieve details of all managers from MongoDB
        const managers = await collection.find({}).toArray();

        // Display the details of all managers with a link to the external CSS file
        res.send(`
            <html>
            <head>
                <link rel="stylesheet" type="text/css" href="/styles.css">
            </head>
            <body>
                <h1>Managers (MongoDB) Page</h1>
                <ul>
                    ${managers.map(manager => `
                        <li>
                            Manager ID: ${manager._id},
                            Name: ${manager.name},
                            Salary: ${manager.salary}
                        </li>
                    `).join('')}
                </ul>
                <a href="/add-manager">Add Manager (MongoDB)</a>
                <!-- Add home button to go back to the homepage -->
                <br>
                <a href="/">Home</a>
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

// GET endpoint for adding a manager (MongoDB)
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

// POST endpoint for adding a manager (MongoDB)
app.post('/managers/add', async (req, res) => {
    const { managerId, name, salary } = req.body;

    // Validate input
    if (!isValidManagerId(managerId) || !isValidName(name) || !isValidSalary(salary)) {
        res.status(400).send('Invalid input. Please check the provided values.');
        return;
    }

    try {
        await client.connect();

        const database = client.db("DCWA"); // Replace with your actual MongoDB database name
        const collection = database.collection("DCWAProj"); // Replace with your actual MongoDB collection name

        // Check if Manager ID is unique
        const isUniqueManagerId = await collection.findOne({ _id: managerId });

        if (isUniqueManagerId) {
            res.status(400).send('Manager ID must be unique.');
            return;
        }

        // Insert the manager into MongoDB
        await collection.insertOne({
            _id: managerId,
            name: name,
            salary: parseInt(salary),
            // Add other properties as needed
        });

        res.redirect('/managers'); // Redirect back to the Managers (MongoDB) page after successful addition
    } catch (error) {
        console.error('Error adding manager to MongoDB:', error);
        res.status(500).send('Internal Server Error');
    } finally {
        await client.close();
    }
});

// Validation functions
function isValidManagerId(managerId) {
    return managerId && managerId.length === 4;
}

function isValidName(name) {
    return name && name.length > 5;
}

function isValidSalary(salary) {
    return salary && !isNaN(salary) && salary >= 30000 && salary <= 70000;
}


// Function to check if Manager ID exists in MongoDB
async function isManagerIdExists(managerId) {
    try {
        await client.connect();

        const database = client.db("DCWA"); // Replace with your actual MongoDB database name
        const collection = database.collection("DCWAProj"); // Replace with your actual MongoDB collection name

        const manager = await collection.findOne({ _id: managerId });

        return !!manager; // Returns true if the manager with the given ID exists, false otherwise
    } finally {
        await client.close();
    }
}

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
