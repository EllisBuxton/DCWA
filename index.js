const express = require('express');
const mysql = require('mysql');
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://g00406866:admin@cluster0.clqcw6z.mongodb.net/?retryWrites=true&w=majority";

const app = express();
const PORT = 3000;

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
    // Connect the client to the server	(optional starting in v4.7)
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

// Example MySQL query
app.get('/mysql/query', (req, res) => {
    const query = 'SELECT * FROM product';
    mysqlConnection.query(query, (error, results) => {
      if (error) {
        console.error('Error executing MySQL query: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        res.json(results);
      }
    });
  });

// Define your routes here

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
