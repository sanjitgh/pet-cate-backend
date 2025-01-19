const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)


// middelware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rwhf0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// verify token
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: 'unauthorized access' });
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' });
    }
    req.user = decoded;
  })
  next()
}

async function run() {
  try {
    const userCollection = client.db("petCere").collection("users");
    const petCollection = client.db("petCere").collection("pets");
    const adoptionRequestCollection = client.db("petCere").collection("adoptionRequest");
    const donationCollection = client.db("petCere").collection("donationsCampaign");
    const donationHistoryCollection = client.db("petCere").collection("donationHistory");


    // generate jws 
    app.post('/jwt', async (req, res) => {
      const email = req.body;
      // create token
      const token = jwt.sign(email, process.env.SECRET_KEY, { expiresIn: '10d' })
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      }).send({ success: true })
    })

    // clear cookie from the browser
    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log('logging out', user);
      res
        .clearCookie('token', { maxAge: 0, sameSite: 'none', secure: true })
        .send({ success: true })
    })

    // save and update user data
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      // check if user exists
      const isExists = await userCollection.findOne(query);
      if (isExists) return res.send({ message: 'user already exist!' });

      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // get all user data
    app.get('/users', verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    // get user role
    app.get('/users/role/:email', async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    })

    // update user role
    app.patch('/user-role/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // create pets 
    app.post('/pets', async (req, res) => {
      const pet = req.body;
      const result = await petCollection.insertOne(pet);
      res.send(result);
    })

    // update pet status
    app.put('/pets/:id', async (req, res) => {
      const id = req.params.id;
      const { adopted } = req.body;
      const query = { _id: new ObjectId(id) };
      const update = { $set: { adopted } };
      const result = await petCollection.updateOne(query, update);
      res.send(result);
    });

    // delete pet
    app.delete('/pets/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petCollection.deleteOne(query);
      res.send(result)
    })

    // delete donation
    app.delete('/donations/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.deleteOne(query);
      res.send(result)
    })

    // delete my donations
    app.delete('/my-donations-remove/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationHistoryCollection.deleteOne(query);
      res.send(result)
    })

    // create donation campaign
    app.post('/donationsCampaign', verifyToken, async (req, res) => {
      const donation = req.body;
      const result = await donationCollection.insertOne(donation);
      res.send(result);
    })


    // update donation campaign
    app.patch('/donationsCampaign/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const item = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          donationLastDate: item.donationLastDate,
          petName: item.petName,
          maxDonationAmount: item.maxDonationAmount,
          sortDescription: item.sortDescription,
          longDescription: item.longDescription,
          petImage: item.petImage,
        }
      }
      const result = await donationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // update donatain amount
    app.patch('/donationAmountUpdate/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const itemPrice = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          donatedAmount: itemPrice.donatedAmount,
        }
      }
      const result = await donationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // update donatain status
    app.patch('/donationStatus/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const itemStatus = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: itemStatus.status,
        }
      }
      const result = await donationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // create donation history
    app.post('/donationsHistory', verifyToken, async (req, res) => {
      const donationInfo = req.body;
      const result = await donationHistoryCollection.insertOne(donationInfo);
      res.send(result);
    })

    // get donation history
    app.get('/donationsHistory', verifyToken, async (req, res) => {
      const result = await donationHistoryCollection.find().toArray()
      res.send(result);
    })

    // create adoption request 
    app.post('/adoptionRequest', verifyToken, async (req, res) => {
      const adoption = req.body;
      const result = await adoptionRequestCollection.insertOne(adoption);
      res.send(result);
    })

    // get adoption request 
    app.get('/adoptionRequest/:email', async (req, res) => {
      const email = req.params.email;
      const query = { hostEmail: email }
      const result = await adoptionRequestCollection.find(query).toArray();
      res.send(result);
    })

    // update adoption request status
    app.patch("/adoptionStatusRequests/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { status }
      }
      const result = await adoptionRequestCollection.updateOne(query, updatedDoc
      );

      res.send(result);
    });


    // get all donations
    app.get('/donations', async (req, res) => {
      const result = await donationCollection.find().toArray();
      res.send(result)
    })

    // get limit donations for recommended
    app.get('/donations-recommend', async (req, res) => {
      const result = await donationCollection.aggregate([{ $sample: { size: 3 } }]).toArray();
      res.send(result)
    })

    // get donation by user email
    app.get('/my-donation/:email', verifyToken, async (req, res) => {
      const query = { donationCreator: req.params.email }
      const result = await donationCollection.find(query).toArray();
      res.send(result)
    })

    // get who is donate my donation campaign
    app.get('/campaign-donation-data/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { donationCreator: email };
      const result = await donationHistoryCollection.find(query).toArray();
      res.send(result);
    })


    // get donation history where i already donation
    app.get('/my-donations-history/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { paymentUserEmail: email };
      const result = await donationHistoryCollection.find(query).toArray();
      res.send(result)
    })

    // get donation by id
    app.get('/donations/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.find(query).toArray();
      res.send(result)
    })

    // get all pets 
    app.get('/pets', async (req, res) => {
      const filter = req.query.filter;
      const search = req.query.search;
      const adopted = req.query.adopted;
      let query = {};

      if (search) query.name = {
        $regex: search,
        $options: 'i'
      }

      if (filter) query.category = filter;

      if (adopted) query.adopted = adopted;

      const result = await petCollection.find(query).toArray();
      res.send(result)
    })

    // get pets by user email
    app.get('/my-pet/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await petCollection.find(query).toArray();
      res.send(result)
    })

    // get pets by id
    app.get('/pet/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petCollection.find(query).toArray();
      res.send(result)
    })

    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;

      if (!price || price <= 0) {
        return res.status(400).json({ error: 'Invalid price provided' });
      }

      try {
        const amount = parseInt(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card'],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });



  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


// view on server UI
app.get("/", (req, res) => {
  res.send("Server is runing")
})

app.listen(port, () => {
  console.log(`Server is runing on port: ${port}`);
})