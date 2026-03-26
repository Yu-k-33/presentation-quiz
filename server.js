import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());

// 本番環境用：ビルドされたReactアプリのファイル（distフォルダ）を配信する
app.use(express.static(join(__dirname, 'dist')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const participants = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Participant joins with nickname
    socket.on('join', (nickname) => {
        participants.set(socket.id, { nickname, points: 0, answers: [] });
        // Tell admin a new participant joined
        io.emit('participants-update', Array.from(participants.values()));
    });

    // Participant submits an answer (to a specific question)
    socket.on('submit-answer', ({ questionIndex, points, answer }) => {
        const participant = participants.get(socket.id);
        if (participant) {
            participant.points += points;
            participant.answers[questionIndex] = answer;
            // Broadcast updated results to anyone listening (the admin)
            io.emit('participants-update', Array.from(participants.values()));
        }
    });

    // Re-emit participants list on request
    socket.on('request-participants', () => {
        socket.emit('participants-update', Array.from(participants.values()));
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Note: We don't remove participants immediately to keep results visible during the presentation.
        // If the browser refreshes, a new participant session usually starts.
    });
});

// Reactのルーティング用：どのURLにアクセスされてもindex.htmlを返す
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Socket server running on port ${PORT}`);
});
