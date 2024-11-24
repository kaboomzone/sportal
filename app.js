const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const multer = require('multer');
const csvParser = require('csv-parser');
const xlsx = require('xlsx');
const fs = require('fs');
const { constrainedMemory } = require('process');
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
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


function isAuthenticated(req, res, next) {
    if (req.session.username) {
        next();
    } else {
        res.redirect('/');
    }
}


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
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM ${feetype[val]} WHERE id = ? AND year = ?`;
        db.all(query, [username, val2], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                let feesdetails;
                let dueMessage = null; // Initialize message variable

                if (rows.length === 0) {
                    feesdetails = [{
                        year: 0,
                        feespaid: 0,
                        feesdue: 0
                    }];
                    dueMessage = `You have NO RECORDS in ${feetype[val]}`;
                    resolve({ feesdetails, dueMessage });
                } else {
                    feesdetails = rows.map(row => {
                        return {
                            year: row.year,
                            feespaid: row.paid,
                            feesdue: row.due
                        };
                    });

                    // Check if there are any dues
                    const hasDue = feesdetails.some(fee => fee.feesdue > 0);
                    if (hasDue) {
                        dueMessage = "You have dues, contact the Admin office.";
                    } else {
                        dueMessage = "No dues.";
                    }

                    resolve({ feesdetails, dueMessage });
                }
            }
        });
    });
};



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
                    let result = (totalMarks / marks.length);
                    const sgpa = Math.round(result*10)/10;
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


const getVideos = (semester,subject,username) => {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM course WHERE sem = ? and subject=?`;
        db.all(query, [semester,subject], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                
                const coursedetails = rows.map(row => ({
                    name: row.name,
                    link: row.link,
                    subject: row.subject
                }));
                resolve({
                    coursedetails
                });
            }
        });
    });
};

const getProfile = (username) => {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM profile WHERE id = ?`;
        db.get(query, [username], (err, row) => {
            if (err) {
                reject(err);
            } else {
                const profile = {
                    name: row.name,
                    email: row.email,
                    phone: row.number,
                    branch: row.branch,
                    section: row.section,
                    dob: row.dob,
                    gender: row.gender,
                    username: row.id,
                    link: row.link
                }
                resolve(profile);
            }
        });
    });
};

const getEvents = (username) => {
    return new Promise((resolve, reject) => {
        const query = `SELECT id, title, description, registerlink, photolink FROM events`;

        db.all(query, (error, rows) => {
            if (error) {
                reject(error); // If there's an error, reject the promise
            } else {
                resolve(rows); // Otherwise, resolve the promise with the retrieved rows
            }
        });
    });
};
 

app.get('/', (req, res) => {
    res.render('login', { errorMessage: '' });
});

app.get('/admin', (req, res) => {
    res.render('admin/login', { errorMessage: '' });
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
        req.session.sem = row.sem;
        req.session.branch = row.branch;
        res.redirect('/course');
    });
});


app.get('/home', isAuthenticated, (req, res) => {
    const query = `SELECT * FROM user WHERE username = ?`;
    const username = req.session.username;
    const sem = req.session.sem;
    db.get(query, [username], (err, row) => {
        if (err) {
            console.error('Error executing query:', err.message);
            res.status(500).send('Internal Server Error');
            return;
        }
        let lastname = row.LASTNAME;
        res.render('home', { lastname, sem});
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


app.post('/marks', isAuthenticated, async (req, res) => {
    const semester = req.body.semester;
    console.log(semester);
    const username = req.session.username;
    try {
        const result = await getMarksBySemester(semester, username);
        res.json({
            marks: result.marks,
            sgpa: result.sgpa,
            cgpa: result.cgpa
        });
    } catch (err) {
        console.error('Error fetching marks:', err.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/course', (req, res) => res.render('course'));

app.get('/attendance', isAuthenticated, async (req, res) => {
    const username = req.session.username;
    try {
        const result = await getAttendance(username);
        console.log(result);
        res.render('attendance', {
            subs: result.attendance,
            totalpercentage: result.totalpercentage
        });
    } catch (err) {
        console.error('Error fetching marks:', err.message);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/fees', isAuthenticated, async (req, res) => {
    const username = req.session.username;
    try {
        const result = {feesdetails:[]}
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
        const result = await getFees(semester, year, username)
        if (result.feesdetails.length === 0) {
            res.json({
                feesdetails: result.feesdetails,
                errormsg: errorMsg
            });
        } else {
            res.json({
                feesdetails: result.feesdetails,
                errormsg: result.dueMessage
            });
        }
    } catch (err) {
        console.error('Error fetching marks:', err.message);
        res.status(500).send('Internal Server Error');
    }
});


/* app.get('/course', (req, res) => {
    res.render('course',{
        coursevideos: [],
        currentsemester: 0,
        subject: 0
    });
});


app.post('/course', isAuthenticated, async (req, res) => {
    const semester = req.body.semester;
    const subject = req.body.subject;
    const username = req.session.username;


    try {
        const result = await getVideos(semester, subject, username);
        res.render('course', {
            coursevideos: result.coursedetails,
            currentsemester: semester,
            subject: subject
        });
    } catch (err) {
        console.error('Error fetching course videos:', err.message);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/coursevideos', isAuthenticated, async (req, res) => {
    const semester = req.query.semester;
    const subject = req.query.subject;
    const username = req.session.username;

    try {
        const result = await getVideos(semester, subject, username);
        res.render('coursevideos', {
            coursevideos: result.coursedetails,
            semester: semester,
            subject: subject
        });
    } catch (err) {
        console.error('Error fetching course videos:', err.message);
        res.status(500).send('Internal Server Error');
    }
});

*/

app.get('/events', async (req, res) => {
    const username = req.query.username || 'defaultUser'; // Replace or adjust to get the username

    try {
        const events = await getEvents(username); // Get events data for the user
        res.render('events', { events }); // Pass events data to EJS template
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).send("Error fetching events");
    }
});


app.get('/profile', isAuthenticated, async (req, res) => {
    const username = req.session.username;
    if(username === undefined){
        res.redirect('/');
    }
    const result = await getProfile(username);
    res.render('profile',{
        results: result,
        message: ""
    });
});

app.post('/changepassword', isAuthenticated, async (req, res) => {
    const username = req.session.username;
    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;
    const confirmPassword = req.body.confirmPassword;

    if(username === undefined){
        res.redirect('/');
    }
    const results = await getProfile(username);


    try {
        const query = `Select * from USER where USERNAME = ? and  PASSWORD = ?`;
        const result = await db.get(query, [username, currentPassword]);
        if (result.length == 0) {
            res.render('profile', {
                results: results,
                message: 'Current password is incorrect'
                });
                } 
        else {
            const query = `UPDATE USER SET PASSWORD = ? WHERE USERNAME = ?`;
            const result = await db.run(query, [newPassword, username]);
            res.render('profile', {
                results: results,
                message: 'Password changed successfully'
                });
            }
    } catch (err) {
        console.error('Error fetching course videos:', err.message);
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


//admin

const getAdminProfile = (username) => {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM adminprofile WHERE id = ?`;
        db.get(query, [username], (err, row) => {
            if (err) {
                reject(err);
            } else {
                const profile = {
                    name: row.name,
                    email: row.email,
                    phone: row.number,
                    branch: row.branch,
                    dob: row.dob,
                    gender: row.gender,
                    username: row.id,
                    link: row.link
                }
                resolve(profile);
            }
        });
    });
};


app.post('/adminlogin', (req, res)=>{
    const { username, password } = req.body;
    const query = `SELECT * FROM admin WHERE username = ?`;

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
        res.redirect('/adminhome');
    });

});

app.get('/adminhome', isAuthenticated, (req, res) => {
    const query = `SELECT * FROM admin WHERE username = ?`;
    const username = req.session.username;
    db.get(query, [username], (err, row) => {
        if (err) {
            console.error('Error executing query:', err.message);
            res.status(500).send('Internal Server Error');
            return;
        }
        let lastname = row.LASTNAME;
        res.render('admin/home', { lastname });
    });
});


app.get('/adminmarks', isAuthenticated, (req, res) => {
    const query = `SELECT * FROM marks`;
    db.all(query, [], (err, rows) => {
        console.log(rows);
        if (err) {
            console.error(err.message);
            res.send('Error retrieving student data');
        } else {
            res.render('admin/marks', { students: rows });
        }
    });
});

const upload = multer({ dest: 'uploads/' });

app.post('/upload-excel', upload.single('excelFile'), (req, res) => {
    const filePath = req.file.path;
  
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Assuming the first sheet is the relevant one
    const worksheet = workbook.Sheets[sheetName];
    const excelData = xlsx.utils.sheet_to_json(worksheet);
  
    excelData.forEach(row => {
      const { id, sem, sub1, sub2, sub3, sub4, sub5, sub6, sgpa, cgpa } = row;
      const sql = 'INSERT INTO marks (id, sem, sub1, sub2, sub3, sub4, sub5, sub6, sgpa, cgpa) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      db.run(sql, [id, sem, sub1, sub2, sub3, sub4, sub5, sub6, sgpa, cgpa], function (err) {
        if (err) {
          console.error('Error inserting row', err);
        } else {
          console.log('Row inserted:', this.lastID); // SQLite provides lastID through 'this'
        }
      });
    });
  
    // Delete the uploaded file
    fs.unlinkSync(filePath);
  
    res.send('Excel file uploaded and data inserted into the database');
  });


  app.get('/adminattendance', isAuthenticated, (req, res) => {
    const query = 'SELECT * FROM attendance';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.send('Error retrieving student data');
        } else {
            res.render('admin/attendance', { students: rows });
        }
    });

});

app.get('/adminfees', isAuthenticated, (req, res) => {
    const query = 'SELECT * FROM tution';
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.send('Error retrieving student data');
        } else {
            res.render('admin/fees', { students: rows });
        }
    });
});

app.post('/adminfees', isAuthenticated, async (req, res) => {
    const feetype = ["tution", "transport","hostel"];
    const semester = req.body.semester;
    const query = 'SELECT * FROM '+feetype[semester];
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.send('Error retrieving student data');
        } else {
            res.render('admin/fees', { students: rows });
        }
    });
});

app.post('/adminchangepassword', isAuthenticated, async (req, res) => {
    const username = req.session.username;
    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;
    const confirmPassword = req.body.confirmPassword;

    if(username === undefined){
        res.redirect('/');
    }
    const results = await getProfile(username);


    try {
        const query = `Select * from admin where USERNAME = ? and  PASSWORD = ?`;
        const result = await db.get(query, [username, currentPassword]);
        if (result.length == 0) {
            res.render('profile', {
                results: results,
                message: 'Current password is incorrect'
                });
                } 
        else {
            const query = `UPDATE admin SET PASSWORD = ? WHERE USERNAME = ?`;
            const result = await db.run(query, [newPassword, username]);
            res.render('profile', {
                results: results,
                message: 'Password changed successfully'
                });
            }
    } catch (err) {
        console.error('Error fetching course videos:', err.message);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/adminlogout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error logging out:', err);
            res.status(500).send('Error logging out.');
        } else {
            res.redirect('/admin');
        }
    });
});

app.get('/adminprofile', isAuthenticated, async (req, res) => {
    const username = req.session.username;
    if(username === undefined){
        res.redirect('/');
    }
    const result = await getAdminProfile(username);
    res.render('admin/profile',{
        results: result,
        message: ""
    });
});