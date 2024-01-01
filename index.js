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
