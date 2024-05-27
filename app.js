const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');

const app = express();
const PORT = 3000;

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

app.use(session({
    secret: 'dont_tell_anyone', 
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));


//Authentication
function isAuthenticated(req, res, next) {
    if (req.session.username) {
        next();
    } else {
        res.redirect('/');
    }
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

    
        req.session.username = username;
        res.redirect('/home');
    });
});

app.get('/home', isAuthenticated, (req, res) => {
    const query = `SELECT * FROM user WHERE username = ?`;
    const username = req.session.username;
    console.log(username);

    db.get(query, [username], (err, row) => {
        if (err) {
            console.error('Error executing query:', err.message);
            res.status(500).send('Internal Server Error');
            return;
        }
        let lastname = row.LASTNAME;
        res.render('home', { lastname });
    });
});

app.get('/marks', isAuthenticated, async (req, res) => {
    const username = req.session.username;
    try {
        const result = await getMarksBySemester(1, username);
        res.render('marks', {
            marks: result.marks,
            sgpa: result.sgpa,
            cgpa: result.cgpa
        });
    } catch (err) {
        console.error('Error fetching marks:', err.message);
        res.status(500).send('Internal Server Error');
    }
});

const getMarksBySemester = (semester, username) => {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM sem${semester} WHERE id = ?`;
        db.get(query, [username], (err, row) => {
            if (err) {
                reject(err);
            } else {
                if (!row) {
                    resolve({
                        marks: [],
                        sgpa : 0,
                        cgpa: 0
                    });
                } else {
                    const marks = [
                        { subject: 'Subject1', marks: row.sub1 },
                        { subject: 'Subject2', marks: row.sub2 },
                        { subject: 'Subject3', marks: row.sub3 },
                        { subject: 'Subject4', marks: row.sub4 },
                        { subject: 'Subject5', marks: row.sub5 },
                        { subject: 'Subject6', marks: row.sub6 }
                    ];
                    const totalMarks = marks.reduce((total, mark) => total + parseInt(mark.marks), 0);
                    const sgpa = (totalMarks / marks.length);
                    const cgpa = row.cgpa;
                    resolve({
                        marks,
                        sgpa,
                        cgpa
                    });
                }
            }
        });
    });
};

app.post('/marks', isAuthenticated, async (req, res) => {
    const semester = req.body.semester;
    const username = req.session.username;
    try {
        const result = await getMarksBySemester(semester, username);
        res.render('marks', {
            marks: result.marks,
            sgpa: result.sgpa,
            cgpa: result.cgpa
        });
    } catch (err) {
        console.error('Error fetching marks:', err.message);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/attendance', isAuthenticated, async (req, res) => {
    const username = req.session.username;
    try {
        const result = await getAttendance(username);
        res.render('attendance', {
            subs: result.attendance,
            totalpercentage: result.totalpercentage
        });
    } catch (err) {
        console.error('Error fetching marks:', err.message);
        res.status(500).send('Internal Server Error');
    }
});

const getAttendance = (username) => {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM attendance WHERE id = ?`;
        db.get(query, [username], (err, row) => {
            if (err) {
                reject(err);
            } else {
                if (!row) {
                    resolve({
                        attendance: [],
                        totalpercentage: 0
                    });
                } else {
                    const attendance = [
                        { subject: 'Subject1', percentage: row.sub1 },
                        { subject: 'Subject2', percentage: row.sub2 },
                        { subject: 'Subject3', percentage: row.sub3 },
                        { subject: 'Subject4', percentage: row.sub4 },
                        { subject: 'Subject5', percentage: row.sub5 },
                        { subject: 'Subject6', percentage: row.sub6 }
                    ];
                    const total = attendance.reduce((total, mark) => total + parseInt(mark.percentage   ), 0);
                    const totalpercentage = (total / attendance.length);
                    resolve({
                        attendance,
                        totalpercentage
                    });
                }
            }
        });
    });
};


const getFees = (val, val2, username) => {
    const feetype = ["tution", "hostel", "transport"];
    console.log(feetype[val]);
    console.log(username);
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM ${feetype[val]} WHERE id = ? and year = ?`;
        db.all(query, [username,val2], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                if (rows.length === 0) {
                    const feesdetails = rows.map(row => ({
                        year: 0,
                        feespaid: 0,
                        feesdue: 0
                    }));
                    resolve({
                        feesdetails
                    });
                } else {
                    const feesdetails = rows.map(row => ({
                        year: row.year,
                        feespaid: row.paid,
                        feesdue: row.due
                    }));
                    resolve({
                        feesdetails
                    });
                }
            }
        });
    });
};


app.get('/fees', isAuthenticated, async (req, res) => {
    const username = req.session.username;
    console.log(username);
    try {
        const result = {feesdetails:[]}
        console.log(result.feesdetails);
        res.render('fees', {
            feesdetails: result.feesdetails,
            errormsg: "Enter Details"
        });
    } catch (err) {
        console.error(  'Error fetching marks:', err.message);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/fees', isAuthenticated, async (req, res) => {
    const feetype = ["tution", "hostel", "transport"];
    const semester = req.body.feestype;
    const year = req.body.year;
    const username = req.session.username;
    const errorMsg = "You have no records in "+ feetype[semester];
    try {
        const result = await getFees(semester, year, username);
        console.log(result.feesdetails.length);
        if (result.feesdetails.length === 0) {
            res.render('fees', {
                feesdetails: result.feesdetails,
                errormsg: errorMsg
            });
        } else {
            res.render('fees', {
                feesdetails: result.feesdetails,
                errormsg: null
            });
        }
    } catch (err) {
        console.error('Error fetching marks:', err.message);
        res.status(500).send('Internal Server Error');
    }
});





app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error logging out:', err);
            res.status(500).send('Error logging out.');
        } else {
            res.redirect('/');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
