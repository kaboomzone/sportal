const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'hello';

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const db = new sqlite3.Database('./db/student.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Function to generate JWT token
function generateToken(username) {
    return jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
}

app.get('/', (req, res) => {
    res.render('login', { errorMessage: '' });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = `SELECT * FROM user WHERE username = ?`;

    db.get(query, [username], (err, row) => {
        if (err) {
            console.error('Error executing query:', err.message);
            res.status(500).send('Internal Server Error');
            return;
        }

        if (!row || row.PASSWORD !== password) {
            res.render('login', { errorMessage: 'Invalid username or password' });
            return;
        }

        const token = generateToken(username);
        res.redirect(`/home?token=${token}`);
    });
});

app.get('/home', (req, res) => {
    const token = req.query.token;

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            console.error('Error verifying JWT:', err.message);
            res.status(401).send('Unauthorized');
            return;
        }
        const query = `SELECT * FROM user WHERE username = ?`;
        const { username } = decoded;

        db.get(query, [username], (err, row) => {
            if (err) {
                console.error('Error executing query:', err.message);
                res.status(500).send('Internal Server Error');
                return;
            }
            let lastname = row.LASTNAME;
        });
        
        res.render('home', { lastname });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
