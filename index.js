require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io"); // Socket io
const http = require("http"); // ✅ HTTP module imported
const { MongoClient, ServerApiVersion } = require("mongodb");
const { ObjectId } = require("mongodb");

const jwt = require("jsonwebtoken");
// const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// ✅ HTTP server created
const server = http.createServer(app);

// ✅ Socket.io server setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // React Frontend cors
    origin: "*", // React Frontend cors for any site
    methods: ["GET", "POST"],
  },
});

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ WebSocket Events
//connection: Triggered when a user connects.
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  //message: Listens for messages from clients
  socket.on("message", (msg) => {
    console.log("Message received:", msg);
    io.emit("message", msg); // Broadcasts to all clients
  });

  //disconnect: Logs when a user leaves.
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

// ✅ MongoDB Connection
//monddB by Satyjit
//mongoDB URI ashraf //Code worked by ashraf
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.k5awq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const eduVibe = client.db("eduVibe");
    const userCollection = eduVibe.collection("users");
    const contactsCollection = eduVibe.collection("contacts");
    const courseCollection = eduVibe.collection("courses");

    //JWT and Token Setting related API
    app.post("/jwt", async (req, res) => {
      const user = req.body; //called as data or payload
      const token = jwt.sign(user, process.env.JWT_ACCESS_TOKEN, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    //JWT middleware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      //Token Verification
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.JWT_ACCESS_TOKEN, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //request verification for admins after JWT verification
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";

      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden admin access" });
      }
      next();
    };

    //admin confirmation API
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden admin access" });
      }
      const query = { email: email };
      const adminUser = await userCollection.findOne(query);
      let admin = false;
      if (adminUser) {
        admin = adminUser?.role === "admin";
      }
      console.log({ admin });
      res.send({ admin });
    });

    app.get("/users", async (req, res) => {
      try {
        const users = await userCollection.find().toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch users" });
      }
    });

    app.post("/contacts", async (req, res) => {
      try {
        const newContact = req.body;
        const result = await contactsCollection.insertOne(newContact);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to save contact" });
      }
    });

    // GET route to fetch all courses
    app.get("/courses", async (req, res) => {
      try {
        const courses = await courseCollection.find().toArray();
        res.status(200).json({ courses });
      } catch (error) {
        console.error("Error fetching courses:", error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    // POST route to add a new course
    app.post("/courses", async (req, res) => {
      try {
        // const collection = await dbConnect("courses");

        const { name, description, instructor, duration, category, price } =
          req.body;

        console.log("Received data:", {
          name,
          description,
          instructor,
          duration,
          category,
          price,
        });

        if (
          !name ||
          !description ||
          !instructor ||
          !duration ||
          !category ||
          !price
        ) {
          return res.status(400).json({ message: "All fields are required" });
        }

        const newCourse = {
          name,
          description,
          instructor,
          duration,
          category,
          price,
        };

        console.log("Inserting new course:", newCourse);
        await courseCollection.insertOne(newCourse);

        res
          .status(201)
          .json({ message: "Course added successfully", course: newCourse });
      } catch (error) {
        console.error("Error during course insertion:", error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    // Route to render course details
    app.get("/courses/:id", async (req, res) => {
      try {
        const course = await courseCollection.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!course) {
          return res.status(404).json({ message: "Course not found" });
        }

        res.status(200).json({ course });
      } catch (error) {
        console.error("Error fetching course:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// ✅ Default Route
app.get("/", (req, res) => {
  res.send("Server Running");
});

// ❌  app.listen(port)  (not connecting with socket)
// ✅ server.listen(port) (Required for both Express routes and WebSocket connections)
server.listen(port, () => {
  console.log(`Server is running at port: ${port}`);
});
