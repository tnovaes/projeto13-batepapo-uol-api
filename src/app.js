import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

// Criação do servidor
const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();

// Configurações do banco de dados
let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient.connect()
    .then(() => (db = mongoClient.db()))
    .catch((err) => console.log(err.message));

// Endpoints
app.post('/participants', async (req, res) => {
    const { name } = req.body;

    const participantSchema = joi.object({
        name: joi.string().required()
    });

    const validation = participantSchema.validate(req.body);
    if (validation.error) return res.status(422).send(validation.error.details[0].message);

    try {
        const registered = await db.collection("participants").findOne({ name });
        if (registered) return res.status(409).send("Nome de usuário já existe.");

        const newParticipant = { name, lastStatus: Date.now() };
        await db.collection("participants").insertOne(newParticipant);

        const message = {
            from: newParticipant.name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format("HH:mm:ss")
        };
        await db.collection("messages").insertOne(message);
        res.sendStatus(201);

    } catch (err) {
        console.log(err.message);
        res.status(500).send(err.message);
    }
});

app.get('/participants', async (req, res) => {
    let participants = [];
    try {
        participants = await db.collection("participants").find().toArray();
        res.send(participants);

    } catch (err) {
        console.log(err.message);
        res.status(500).send(err.message);
    }
});

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid("message", "private_message").required()
    });

    const validation = messageSchema.validate(req.body, { abortEarly: false });
    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try {
        const registered = await db.collection("participants").findOne({ name: from });
        if (!registered) return res.sendStatus(422);

        const newMessage = {
            from,
            to,
            text,
            type,
            time: dayjs().format("HH:mm:ss")
        };
        await db.collection("messages").insertOne(newMessage);
        res.sendStatus(201);

    } catch (err) {
        console.log(err.message);
        res.status(500).send(err.message);
    }
});

app.get('/messages', async (req, res) => {
    const user = req.headers.user;
    const limit = req.query.limit;

    if (parseInt(limit) <= 0) return res.sendStatus(422);
    if (isNaN(limit)) {
        if (limit != undefined) return res.sendStatus(422);
    }

    try {
        const messages = await db.collection("messages")
            .find({
                $or: [
                    { to: "Todos" },
                    { to: user },
                    { from: user },
                    { type: "message" }
                ]
            })
            .limit(parseInt(limit)).toArray();
        res.send(messages);

    } catch (err) {
        console.log(err.message);
        res.status(500).send(err.message);
    }
});

app.post('/status', async (req, res) => {
    const user = req.headers.user;

    if (!user) return res.sendStatus(404);

    const lastStatus = Date.now();

    try {
        const update = await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus } });

        if (!update.matchedCount) return res.sendStatus(404);

        res.sendStatus(200);

    } catch (err) {
        console.log(err.message);
        res.status(500).send(err.message);
    }
});

setInterval(async () => {
    const disconnected = Date.now() - 10000;

    try {
        const dcUsers = await db.collection("participants").find({ lastStatus: { $lt: disconnected } }).toArray;

        if (dcUsers) {
            dcUsers.forEach((u) => {
                db.collection("participants").insertOne({
                    from: u.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format("HH:mm:ss")
                });
            });
        }

        await db.collection("participants").deleteMany({ lastStatus: { $lt: disconnected } });

    } catch (err) {
        console.log(err.message);
    }

}, 15000)

// Deixa o app escutando, à espera de requisições
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`)) 