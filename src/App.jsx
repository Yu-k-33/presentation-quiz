import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, ShieldCheck, User, Users } from 'lucide-react';
import confetti from 'canvas-confetti';

const socket = io(import.meta.env.PROD ? '/' : 'http://localhost:3001');

const QUESTIONS = [
    {
        type: 'choice',
        title: '幼少期の僕が「ふんかんこん」と言い間違えていたものはどれでしょう？',
        choices: ['①新幹線', '②ポップコーン', '③フンコロガシ', '④フランクフルト'],
        correct: 3,
    },
    {
        type: 'multi',
        title: '給食苦手な僕が実際に行ったことを全て選べ！',
        choices: [
            '①チーズをバックに入れて家に持ち帰った',
            '②ミニトマトが出る日は学校を休んでいた',
            '③オムレツをお道具箱に隠した',
            '④給食が食べきれないまま下校の時間になった'
        ],
        correct: [0, 1, 2, 3],
    },
    {
        type: 'text',
        title: '謎を解くと現れる単語をアルファベット2文字でお答えください',
        image: '/オセロ.png',
        correct: 'AI',
        hasSecret: true
    },
    {
        type: 'text',
        title: '謎解きサークルのスローガンの？に入る漢字3文字の言葉はなんでしょう？',
        placeholder: '漢字3文字で入力',
        correct: '非日常',
    }
];

function App() {
    const [view, setView] = useState('welcome'); // welcome, question, result, admin
    const [nickname, setNickname] = useState('');
    const [currentStep, setCurrentStep] = useState(0);
    const [totalPoints, setTotalPoints] = useState(0);
    const [selectedChoices, setSelectedChoices] = useState([]);
    const [textInput, setTextInput] = useState('');
    const [secretFound, setSecretFound] = useState(false);
    const [password, setPassword] = useState('');
    const [participants, setParticipants] = useState([]);
    const [submitted, setSubmitted] = useState(false); // <== Fixed hook position
    const canvasRef = useRef(null);

    useEffect(() => {
        socket.on('participants-update', (data) => {
            setParticipants(data);
        });

        return () => {
            socket.off('participants-update');
        };
    }, []);

    const handleStart = () => {
        if (!nickname.trim()) return;
        socket.emit('join', nickname);
        setView('question');
    };

    const handleSubmitChoice = (idx) => {
        const q = QUESTIONS[currentStep];
        const isCorrect = idx === q.correct;
        const pts = isCorrect ? 1 : 0;

        setTotalPoints(p => p + pts);
        socket.emit('submit-answer', {
            questionIndex: currentStep,
            points: pts,
            answer: q.choices[idx]
        });
        setSelectedChoices([idx]);
    };

    const handleMultiSelect = (idx) => {
        if (selectedChoices.includes(idx)) {
            setSelectedChoices(selectedChoices.filter(i => i !== idx));
        } else {
            setSelectedChoices([...selectedChoices, idx]);
        }
    };

    const handleSubmitMulti = () => {
        const q = QUESTIONS[currentStep];
        const isCorrect = q.correct.length === selectedChoices.length &&
            q.correct.every(val => selectedChoices.includes(val));
        const pts = isCorrect ? 1 : 0;

        setTotalPoints(p => p + pts);
        socket.emit('submit-answer', {
            questionIndex: currentStep,
            points: pts,
            answer: selectedChoices.map(i => q.choices[i]).join(', ')
        });
        // Move logic happens via button
    };

    const handleSubmitText = () => {
        const q = QUESTIONS[currentStep];
        const isCorrect = textInput.trim().toUpperCase() === q.correct.toUpperCase();

        let pts = 0;
        if (isCorrect) {
            pts = 1;
            // Secret logic for Q3
            if (q.hasSecret && secretFound) {
                pts = 10;
            }
        }

        setTotalPoints(p => p + pts);
        socket.emit('submit-answer', {
            questionIndex: currentStep,
            points: pts,
            answer: textInput
        });
    };

    const nextStep = () => {
        if (currentStep < QUESTIONS.length - 1) {
            setCurrentStep(s => s + 1);
            setSelectedChoices([]);
            setTextInput('');
            setSecretFound(false);
        } else {
            setView('result');
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#ffd700', '#ffffff', '#ff8c00']
            });
        }
    };

    const handleSecretClick = () => {
        alert('よく気づきましたね！このことは公演終了まで内密にお願いしますm(_ _)m');
        setSecretFound(true);
    };

    const handleAdminAccess = () => {
        if (password === '7802') {
            setView('admin');
            socket.emit('request-participants');
        } else {
            alert('パスワードが違います');
        }
    };

    // Views
    if (view === 'welcome') {
        return (
            <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1>Antigravity Quiz</h1>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <Trophy size={64} color="#ffd700" />
                </div>
                <p style={{ textAlign: 'center', fontSize: '1.2rem' }}>
                    参加するにはニックネームを登録してください
                </p>
                <input
                    autoFocus
                    className="input-field"
                    placeholder="ニックネーム"
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStart()}
                />
                <button className="primary-button" onClick={handleStart}>
                    ゲームスタート
                </button>
                <div className="admin-link" onClick={() => {
                    const pass = prompt('管理者パスワードを入力してください');
                    if (pass === '7802') {
                        setView('admin');
                        socket.emit('request-participants');
                    }
                }}>
                    管理者ページ
                </div>
            </motion.div>
        );
    }

    if (view === 'admin') {
        return (
            <motion.div className="glass-card" style={{ maxWidth: '800px' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2><ShieldCheck style={{ verticalAlign: 'middle', marginRight: '8px' }} /> 管理者ダッシュボード</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', opacity: 0.8 }}>
                    <Users size={18} />
                    <span>参加者数: {participants.length}名</span>
                </div>
                <table className="scoreboard">
                    <thead>
                        <tr>
                            <th>順位</th>
                            <th>ニックネーム</th>
                            <th>獲得ポイント</th>
                        </tr>
                    </thead>
                    <tbody>
                        {participants
                            .sort((a, b) => b.points - a.points)
                            .map((p, idx) => (
                                <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td>{p.nickname}</td>
                                    <td>{p.points}pt</td>
                                </tr>
                            ))}
                    </tbody>
                </table>
                <button className="primary-button" style={{ marginTop: '2rem' }} onClick={() => setView('welcome')}>
                    戻る
                </button>
            </motion.div>
        );
    }

    if (view === 'result') {
        return (
            <motion.div className="glass-card" style={{ textAlign: 'center' }} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <h1>Final Results</h1>
                <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>お疲れ様でした！</div>
                <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.5)' }}>
                    {totalPoints} <span style={{ fontSize: '1.5rem' }}>pts</span>
                </div>
                <div style={{ marginTop: '2rem', opacity: 0.7 }}>
                    プレゼンの続きもお楽しみください！
                </div>
            </motion.div>
        );
    }

    // Question view
    const q = QUESTIONS[currentStep];
    const isAnswered = q.type === 'choice' ? selectedChoices.length > 0 : (q.type === 'multi' ? selectedChoices.length > 0 && selectedChoices.submitted : textInput.length > 0 && q.submitted);

    return (
        <motion.div
            key={currentStep}
            className="glass-card"
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.9rem', opacity: 0.6 }}>第 {currentStep + 1} 問 / {QUESTIONS.length}</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <img src="/得点.png" className="score-badge" alt="score" />
                    <span style={{ color: '#ffd700', fontWeight: 'bold' }}> {totalPoints} pt</span>
                </div>
            </div>

            {!q.image && (
                <h3 style={{ fontSize: '1.25rem', lineHeight: '1.6', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {q.title}
                    <img src="/得点.png" className="score-badge" alt="score" style={{ width: '28px', height: '28px', flexShrink: 0 }} />
                </h3>
            )}

            {q.image && (
                <div className="question-img-container">
                    <img src={q.image} className="question-img" alt="question" />
                    {q.hasSecret && (
                        <img
                            src={secretFound ? '/得点ゼロ.png' : '/得点星.png'}
                            className="star-btn"
                            onClick={handleSecretClick}
                            alt="secret"
                        />
                    )}
                </div>
            )}

            {q.type === 'choice' && (
                <div className="choice-list">
                    {q.choices.map((choice, idx) => (
                        <div
                            key={idx}
                            className={`choice-item ${selectedChoices.includes(idx) ? 'selected' : ''} ${submitted ? 'disabled' : ''}`}
                            onClick={() => {
                                if (!submitted) {
                                    handleSubmitChoice(idx);
                                    setSubmitted(true);
                                }
                            }}
                        >
                            {choice}
                        </div>
                    ))}
                </div>
            )}

            {q.type === 'multi' && (
                <div className="choice-list">
                    {q.choices.map((choice, idx) => (
                        <div
                            key={idx}
                            className={`choice-item ${selectedChoices.includes(idx) ? 'selected' : ''}`}
                            onClick={() => !submitted && handleMultiSelect(idx)}
                        >
                            <input
                                type="checkbox"
                                checked={selectedChoices.includes(idx)}
                                readOnly
                                style={{ width: '18px', height: '18px' }}
                            />
                            {choice}
                        </div>
                    ))}
                    {!submitted && (
                        <button className="primary-button" style={{ marginTop: '1rem' }} onClick={() => {
                            handleSubmitMulti();
                            setSubmitted(true);
                        }}>
                            決定
                        </button>
                    )}
                </div>
            )}

            {q.type === 'text' && (
                <>
                    {!submitted ? (
                        <>
                            <input
                                className="input-field"
                                placeholder={q.placeholder || "解答をここに入力"}
                                value={textInput}
                                onChange={e => setTextInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && textInput.trim() && (handleSubmitText(), setSubmitted(true))}
                            />
                            <button
                                className="primary-button"
                                disabled={!textInput.trim()}
                                onClick={() => {
                                    handleSubmitText();
                                    setSubmitted(true);
                                }}
                            >
                                決定
                            </button>
                        </>
                    ) : (
                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '12px', textAlign: 'center', marginBottom: '1.5rem' }}>
                            回答を送信しました：<strong>{textInput}</strong>
                        </div>
                    )}
                </>
            )}

            {submitted && (
                <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="primary-button"
                    style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', border: '1px solid #ffd700', color: '#ffd700' }}
                    onClick={() => {
                        nextStep();
                        setSubmitted(false);
                    }}
                >
                    次の問題へ
                </motion.button>
            )}
        </motion.div>
    );
}

export default App;
