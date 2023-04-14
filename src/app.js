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
    const participantSchema = joi.object({
        name: joi.string().required()
    });

    const validation = participantSchema.validate(req.body);
    if (validation.error) return res.status(422).send(validation.error.details[0].message);
    const { name } = req.body

    try {
        const registered = await db.collection("participants").findOne({name});
        if (registered) return res.status(409).send("Nome de usuário já existe.")

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

// Deixa o app escutando, à espera de requisições
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`)) 