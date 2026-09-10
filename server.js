const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.static("public"));


// ================= MYSQL CONNECTION =================

const db = mysql.createConnection({
    host: process.env.MYSQLHOST || process.env.MYSQL_HOST,
    port: process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQLUSER || process.env.MYSQL_USER,
    password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE
});

db.connect((err) => {

    if (err) {
        console.log("❌ MySQL connection failed");
        console.log(err.message);
        return;
    }

    console.log("✅ MySQL connected successfully");

});


// ================= OTP STORAGE =================

const otpStore = new Map();


// ================= LOGIN =================

app.post("/login", (req, res) => {

    const { reg_no, password } = req.body;

    if (!reg_no || !password) {

        return res.json({
            success: false,
            message: "Please enter Register Number and Password"
        });

    }

    const sql =
        "SELECT * FROM students WHERE reg_no = ?";

    db.query(sql, [reg_no], (err, result) => {

        if (err) {

            console.log(err);

            return res.json({
                success: false,
                message: "Database error"
            });

        }

        if (result.length === 0) {

            return res.json({
                success: false,
                message: "Student not found"
            });

        }

        const student = result[0];

        // Demo password checking
        if (password === student.password) {

            return res.json({
                success: true,
                message: "Login successful"
            });

        }

        return res.json({
            success: false,
            message: "Incorrect password"
        });

    });

});
app.post("/teacher-login", (req, res) => {

    const { teacher_id, password } = req.body;

    if (!teacher_id || !password) {

        return res.json({
            success: false,
            message: "Please enter Teacher ID and Password"
        });

    }

    const teacherSql = `
        SELECT *
        FROM teachers
        WHERE teacher_id = ?
    `;

    db.query(
        teacherSql,
        [teacher_id],
        (err, result) => {

            if (err) {

                console.log(err);

                return res.json({
                    success: false,
                    message: "Database error"
                });

            }

            if (result.length === 0) {

                return res.json({
                    success: false,
                    message: "Teacher account not found"
                });

            }

            const teacher = result[0];

            if (password !== teacher.password) {

                return res.json({
                    success: false,
                    message: "Incorrect password"
                });

            }

            res.json({
                success: true,
                message: "✅ Teacher login successful"
            });

        }
    );

});

// ================= SEND OTP =================

app.post("/send-otp", (req, res) => {

    const { reg_no, mobile } = req.body;

    if (!reg_no || !mobile) {

        return res.json({
            success: false,
            message: "Please enter Register Number and Mobile Number"
        });

    }

    // Generate 6 digit OTP

    const otp =
        Math.floor(100000 + Math.random() * 900000)
        .toString();

    // OTP valid for 5 minutes

    const expiresAt = Date.now() + (60 * 1000);


    // Store OTP

    otpStore.set(reg_no, {

        otp: otp,

        mobile: mobile,

        expiresAt: expiresAt

    });
     const presentsql = `
        UPDATE students
        SET mobile = ?
        WHERE reg_no = ?
    `;

    db.query(presentsql, [mobile, reg_no], (err) => {

        if (err) {
            console.log(err);
        }

    });

setTimeout(() => {
    const data = otpStore.get(reg_no);

    if (data && Date.now() >= data.expiresAt) {

        otpStore.delete(reg_no);

        const sql = `
            INSERT INTO attendance
            (reg_no, attendance_date, status)
            VALUES (?, CURDATE(), 'Absent')
            ON DUPLICATE KEY UPDATE
            status = 'Absent'
        `;

        db.query(sql, [reg_no], (err) => {
            if (err) {
                console.log("Error marking absent:", err.message);
            } else {
                console.log("❌ " + reg_no + " marked ABSENT");
            }
        });
    }
}, 60 * 1000);
    // Save mobile number in MySQL

    const absentsql = `
        UPDATE students
        SET mobile = ?
        WHERE reg_no = ?
    `;

    db.query(absentsql, [mobile, reg_no], (err) => {

        if (err) {
            console.log(err);
        }

    });


    // Show OTP in VS Code terminal

    console.log("");
    console.log("================================");
    console.log("📱 DEMO OTP");
    console.log("Register Number:", reg_no);
    console.log("Mobile:", mobile);
    console.log("OTP:", otp);
    console.log("Valid for: 5 minutes");
    console.log("================================");
    console.log("");


    res.json({
    success: true,
    message: "OTP generated",
    otp: otp
});

});


// ================= VERIFY OTP =================

app.post("/verify-otp", (req, res) => {

    const { reg_no, mobile, otp } = req.body;

    if (!reg_no || !mobile || !otp) {

        return res.json({

            success: false,

            message: "Please enter all details"

        });

    }


    const data =
        otpStore.get(reg_no);


    if (!data) {

        return res.json({

            success: false,

            message:
                "OTP not found. Please send OTP again."

        });

    }


    // Check OTP expiry

    if (Date.now() > data.expiresAt) {

        otpStore.delete(reg_no);

        return res.json({

            success: false,

            message:
                "OTP expired. Please request a new OTP."

        });

    }


    // Check OTP

    if (data.otp !== otp) {

        return res.json({

            success: false,

            message: "❌ Incorrect OTP"

        });

    }


    // Check mobile

    if (data.mobile !== mobile) {

        return res.json({

            success: false,

            message:
                "❌ Mobile number does not match"

        });

    }


    // OTP successful

    otpStore.delete(reg_no);


    // Mark attendance

    const sql = `
        INSERT INTO attendance
        (reg_no, attendance_date, status)

        VALUES
        (?, CURDATE(), 'Present')

        ON DUPLICATE KEY UPDATE
        status = 'Present'
    `;


    db.query(sql, [reg_no], (err) => {

        if (err) {

            console.log(err);

            return res.json({

                success: false,

                message:
                    "Unable to mark attendance"

            });

        }


        res.json({

            success: true,

            message:
                "✅ Attendance marked Present!"

        });

    });

});


// ================= ATTENDANCE STATUS =================

app.get("/attendance/:reg_no", (req, res) => {

    const reg_no =
        req.params.reg_no;


    const sql = `
        SELECT attendance_date, status

        FROM attendance

        WHERE reg_no = ?

        ORDER BY attendance_date DESC
    `;


    db.query(sql, [reg_no], (err, result) => {

        if (err) {

            console.log(err);

            return res.json({

                success: false,

                message:
                    "Database error"

            });

        }


        res.json({

            success: true,

            attendance: result

        });

    });

});


// ================= START SERVER =================

const PORT =
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/login.html");
});
   
process.env.PORT || 3000;
// STUDENT REGISTRATION

app.post("/register-student", (req, res) => {

    const { reg_no, password, mobile } = req.body;

    if (!reg_no || !password || !mobile) {

        return res.json({
            success: false,
            message: "Please enter all details"
        });

    }

    const registerNumber =
        reg_no.trim().toUpperCase();

    // Must start with 26CS
    if (!/^26CS\d+$/i.test(registerNumber)) {

        return res.json({
            success: false,
            message: "Register Number must start with 26CS"
        });

    }

    const sql = `
        INSERT INTO students
        (reg_no, password, mobile)
        VALUES (?, ?, ?)
    `;

    db.query(
        sql,
        [registerNumber, password, mobile],
        (err) => {

            if (err) {

                if (err.code === "ER_DUP_ENTRY") {

                    return res.json({
                        success: false,
                        message:
                            "Register Number already exists"
                    });

                }

                console.log(err);

                return res.json({
                    success: false,
                    message: "Database error"
                });

            }

            res.json({
                success: true,
                message:
                    "✅ Account created successfully. Please login."
            });

        }
    );

});
// TEACHER LOGIN




app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);


    console.log("");
    console.log("================================");
    console.log("🎓 DAILY ATTENDANCE SYSTEM");
    console.log("================================");
    console.log(
        "🌐 http://localhost:" + PORT
    );
    console.log("================================");
    console.log("");

});