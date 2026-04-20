import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate Exam Notice/Routine PDF
 * @param {Object} exam - Exam document with populated routine
 * @param {string} outputPath - Path where PDF will be saved
 */
export async function generateExamNoticePDF(exam, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true
      });

      // Pipe to file
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // School Header
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('SHINING STAR ENGLISH SCHOOL', { align: 'center' })
        .moveDown(0.3);

      doc
        .fontSize(12)
        .font('Helvetica')
        .text('Ranjha-09, Mahottari', { align: 'center' })
        .text('Phone: [School Phone]', { align: 'center' })
        .moveDown(1);

      // Horizontal line
      doc
        .strokeColor('#000000')
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(1);

      // Exam Notice Title
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('EXAMINATION NOTICE', { align: 'center', underline: true })
        .moveDown(1);

      // Exam Details
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`Exam Name: `, { continued: true })
        .font('Helvetica')
        .text(exam.examName)
        .moveDown(0.5);

      doc
        .font('Helvetica-Bold')
        .text(`Exam Type: `, { continued: true })
        .font('Helvetica')
        .text(exam.examType + (exam.terminalNumber ? ` - Terminal ${exam.terminalNumber}` : ''))
        .moveDown(0.5);

      doc
        .font('Helvetica-Bold')
        .text(`Academic Year: `, { continued: true })
        .font('Helvetica')
        .text(exam.academicYear)
        .moveDown(0.5);

      doc
        .font('Helvetica-Bold')
        .text(`Exam Period: `, { continued: true })
        .font('Helvetica')
        .text(`${formatDate(exam.startDate)} to ${formatDate(exam.endDate)}`)
        .moveDown(1.5);

      // Exam Routine Section
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('EXAMINATION ROUTINE', { align: 'center', underline: true })
        .moveDown(1);

      // Group routine by class
      const routineByClass = {};
      exam.routine.forEach(entry => {
        const className = entry.class.className;
        if (!routineByClass[className]) {
          routineByClass[className] = [];
        }
        routineByClass[className].push(entry);
      });

      // Display routine for each class
      Object.keys(routineByClass).sort().forEach((className, index) => {
        if (index > 0 && doc.y > 650) {
          doc.addPage();
        }

        doc
          .fontSize(13)
          .font('Helvetica-Bold')
          .fillColor('#1a1a1a')
          .text(`Class: ${className}`, { underline: true })
          .moveDown(0.5);

        // Table headers
        const tableTop = doc.y;
        const col1X = 70;
        const col2X = 200;
        const col3X = 370;
        const col4X = 470;

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .text('Date', col1X, tableTop)
          .text('Subject', col2X, tableTop)
          .text('Time', col3X, tableTop)
          .text('Duration', col4X, tableTop);

        doc
          .moveTo(50, tableTop + 15)
          .lineTo(545, tableTop + 15)
          .stroke();

        let currentY = tableTop + 25;

        // Sort entries by date
        routineByClass[className].sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

        // Table rows
        routineByClass[className].forEach((entry) => {
          doc
            .fontSize(10)
            .font('Helvetica')
            .text(formatDate(entry.examDate), col1X, currentY, { width: 120 })
            .text(entry.subject.subjectName, col2X, currentY, { width: 160 })
            .text(`${entry.startTime} - ${entry.endTime}`, col3X, currentY, { width: 90 })
            .text(`${entry.duration} min`, col4X, currentY, { width: 60 });

          currentY += 20;

          // Add page if needed
          if (currentY > 700) {
            doc.addPage();
            currentY = 50;
          }
        });

        doc.moveDown(2);
      });

      // Important Instructions
      if (doc.y > 600) {
        doc.addPage();
      }

      doc
        .moveDown(2)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('IMPORTANT INSTRUCTIONS:', { underline: true })
        .moveDown(0.5)
        .fontSize(10)
        .font('Helvetica')
        .text('1. Students must arrive 15 minutes before the exam starts.')
        .text('2. Students must bring their admit card and valid ID.')
        .text('3. Electronic devices (mobile phones, calculators, etc.) are strictly prohibited.')
        .text('4. Students must maintain discipline during the examination.')
        .text('5. Students caught using unfair means will be disqualified.')
        .moveDown(2);

      // Footer
      const footerY = doc.page.height - 100;
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('____________________', 350, footerY)
        .text('Principal\'s Signature', 350, footerY + 15, { align: 'left' })
        .moveDown(0.5)
        .fontSize(9)
        .font('Helvetica')
        .text(`Date: ${formatDate(new Date())}`, 350, footerY + 35);

      // Finalize PDF
      doc.end();

      writeStream.on('finish', () => {
        resolve(outputPath);
      });

      writeStream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate Progress Report PDF
 * @param {Object} progressReport - Progress report document with populated data
 * @param {string} outputPath - Path where PDF will be saved
 */
export async function generateProgressReportPDF(progressReport, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true
      });

      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // School Header
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('SHINING STAR ENGLISH SCHOOL', { align: 'center' })
        .moveDown(0.3);

      doc
        .fontSize(11)
        .font('Helvetica')
        .text('Ranjha-09, Mahottari', { align: 'center' })
        .moveDown(0.8);

      // Title
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('PROGRESS REPORT', { align: 'center', underline: true })
        .moveDown(0.5);

      doc
        .fontSize(11)
        .font('Helvetica')
        .text(`Academic Year: ${progressReport.academicYear}`, { align: 'center' })
        .moveDown(1);

      // Student Info Box
      doc
        .rect(50, doc.y, 495, 80)
        .stroke();

      const infoY = doc.y + 10;
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Student Name: ', 60, infoY, { continued: true })
        .font('Helvetica')
        .text(progressReport.student.name)
        .moveDown(0.5);

      doc
        .font('Helvetica-Bold')
        .text('Student ID: ', 60, doc.y, { continued: true })
        .font('Helvetica')
        .text(progressReport.student.studentId, { continued: true })
        .font('Helvetica-Bold')
        .text('     Roll No: ', { continued: true })
        .font('Helvetica')
        .text(progressReport.student.rollNumber?.toString() || 'N/A')
        .moveDown(0.5);

      doc
        .font('Helvetica-Bold')
        .text('Class: ', 60, doc.y, { continued: true })
        .font('Helvetica')
        .text(progressReport.class.className, { continued: true })
        .font('Helvetica-Bold')
        .text('     Date of Birth: ', { continued: true })
        .font('Helvetica')
        .text(formatDate(progressReport.student.dateOfBirth))
        .moveDown(1.5);

      // Terminal Results Section
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('TERMINAL EXAMINATION RESULTS', { align: 'center', underline: true })
        .moveDown(1);

      // Display each terminal
      progressReport.terminals.forEach((terminal, index) => {
        if (doc.y > 650) {
          doc.addPage();
        }

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`Terminal ${terminal.terminalNumber}`, { underline: true })
          .moveDown(0.3);

        if (!terminal.marks) {
          doc
            .fontSize(10)
            .font('Helvetica')
            .text('Not yet completed', { italics: true })
            .moveDown(1);
          return;
        }

        // Terminal summary
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(`GPA: `, { continued: true })
          .font('Helvetica')
          .text(`${terminal.gpa.toFixed(2)}`, { continued: true })
          .font('Helvetica-Bold')
          .text(`     Grade: `, { continued: true })
          .font('Helvetica')
          .text(terminal.grade)
          .moveDown(0.3);

        // Attendance
        doc
          .font('Helvetica-Bold')
          .text(`Attendance: `, { continued: true })
          .font('Helvetica')
          .text(`${terminal.attendance.present}/${terminal.attendance.totalDays} (${terminal.attendance.percentage}%)`)
          .moveDown(1);
      });

      // Yearly Summary
      if (doc.y > 650) {
        doc.addPage();
      }

      doc
        .moveDown(1)
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('YEARLY SUMMARY', { align: 'center', underline: true })
        .moveDown(0.8);

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(`Overall GPA: `, { continued: true })
        .font('Helvetica')
        .text(`${progressReport.yearlyTotal.gradePoint.toFixed(2)}`, { continued: true })
        .font('Helvetica-Bold')
        .text(`     Overall Grade: `, { continued: true })
        .font('Helvetica')
        .text(progressReport.yearlyTotal.grade)
        .moveDown(2);

      // Signatures
      const signY = doc.page.height - 120;
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('____________________', 60, signY)
        .text('Class Teacher', 60, signY + 15)
        .text('____________________', 250, signY)
        .text('Principal', 250, signY + 15)
        .text('____________________', 440, signY)
        .text('Parent/Guardian', 440, signY + 15);

      doc.end();

      writeStream.on('finish', () => {
        resolve(outputPath);
      });

      writeStream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Helper function to format dates
 */
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Ensure uploads directory exists
 */
export function ensureUploadsDir() {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'pdfs');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

/**
 * Helper function to convert number to words (for Nepali Rupees)
 */
function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (num === 0) return 'Zero';

  function convertLessThanThousand(n) {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
  }

  function convertLessThanMillion(n) {
    if (n === 0) return '';
    if (n < 1000) return convertLessThanThousand(n);
    return convertLessThanThousand(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convertLessThanThousand(n % 1000) : '');
  }

  if (num < 1000000) return convertLessThanMillion(num);
  return convertLessThanThousand(Math.floor(num / 1000000)) + ' Million' + (num % 1000000 !== 0 ? ' ' + convertLessThanMillion(num % 1000000) : '');
}

/**
 * Generate Demand/Cash Bill PDF (like fee bill template)
 * @param {Object} billData - Bill information
 * @param {string} outputPath - Path where PDF will be saved
 */
export async function generateDemandBill(billData, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // School Header - Border
      doc.rect(30, 30, 535, 750).stroke();

      // School Name
      doc.fontSize(18).font('Helvetica-Bold')
        .text('SHINING STAR ENGLISH SCHOOL', 50, 50, { align: 'center' });

      // School Address
      doc.fontSize(10).font('Helvetica')
        .text('Yangwarak-4, Tharpu, Panchthar', 50, 75, { align: 'center' })
        .text('Estd:2051', 50, 90, { align: 'center' })
        .text('Province No. 1, Nepal', 50, 105, { align: 'center' });

      // Bill Number
      doc.fontSize(14).font('Helvetica-Bold')
        .text(billData.billNumber || '000000', 50, 140);

      // Demand/Cash-Bill label
      doc.fontSize(12).font('Helvetica')
        .text('Demand', 250, 140)
        .text('Cash-Bill', 250, 155);

      // Date
      const dateStr = new Date(billData.date).toLocaleDateString('en-GB');
      doc.text(`Date: ${dateStr}`, 450, 140);

      // S.N. label
      doc.fontSize(10).text('S.N.', 50, 140);

      // Student Information
      doc.fontSize(11).font('Helvetica')
        .text(`Name: ${billData.studentName}`, 50, 185);

      doc.text(`Class: ${billData.className || ''}`, 50, 205)
        .text(`Roll No: ${billData.rollNumber || ''}`, 250, 205)
        .text(`Fees for the month of/from ${billData.feeMonth || ''}`, 350, 205);

      // Table Header
      let tableTop = 240;
      doc.rect(40, tableTop, 525, 25).stroke();

      doc.fontSize(10).font('Helvetica-Bold')
        .text('S.No.', 50, tableTop + 8)
        .text('Particulars', 120, tableTop + 8)
        .text('Rate', 380, tableTop + 8)
        .text('Remarks', 480, tableTop + 8);

      doc.fontSize(9).text('Rs.', 380, tableTop + 20)
        .text('Ps.', 430, tableTop + 20);

      // Table Rows - Fee Items
      let currentY = tableTop + 30;
      const feeBreakdown = billData.feeBreakdown || [];

      feeBreakdown.forEach((item, index) => {
        doc.rect(40, currentY - 5, 525, 25).stroke();

        doc.fontSize(10).font('Helvetica')
          .text(`${index + 1}.`, 50, currentY)
          .text(item.feeType, 120, currentY);

        const rupees = Math.floor(item.amount);
        const paisa = Math.round((item.amount - rupees) * 100);

        doc.text(rupees.toString(), 380, currentY)
          .text(paisa > 0 ? paisa.toString() : '', 430, currentY);

        currentY += 25;
      });

      // Add empty rows to fill the table (up to row 12)
      const totalRows = 12;
      for (let i = feeBreakdown.length; i < totalRows; i++) {
        doc.rect(40, currentY - 5, 525, 25).stroke();
        doc.fontSize(10).text(`${i + 1}.`, 50, currentY);
        currentY += 25;
      }

      // Total Amount Row
      doc.rect(40, currentY - 5, 525, 25).stroke();
      doc.fontSize(10).font('Helvetica-Bold')
        .text('Total Amount', 120, currentY);

      const totalRupees = Math.floor(billData.totalAmount);
      const totalPaisa = Math.round((billData.totalAmount - totalRupees) * 100);

      doc.text(totalRupees.toString(), 380, currentY)
        .text(totalPaisa > 0 ? totalPaisa.toString() : '', 430, currentY);

      currentY += 25;

      // Advance Row
      doc.rect(40, currentY - 5, 525, 25).stroke();
      doc.fontSize(10).font('Helvetica-Bold')
        .text('Advance', 120, currentY);

      if (billData.advance && billData.advance > 0) {
        const advRupees = Math.floor(billData.advance);
        const advPaisa = Math.round((billData.advance - advRupees) * 100);
        doc.text(advRupees.toString(), 380, currentY)
          .text(advPaisa > 0 ? advPaisa.toString() : '', 430, currentY);
      }

      currentY += 25;

      // G.Total Row
      doc.rect(40, currentY - 5, 525, 25).stroke();
      doc.fontSize(10).font('Helvetica-Bold')
        .text('G.Total', 120, currentY);

      const grandTotal = billData.totalAmount - (billData.advance || 0);
      const gtRupees = Math.floor(grandTotal);
      const gtPaisa = Math.round((grandTotal - gtRupees) * 100);

      doc.text(gtRupees.toString(), 380, currentY)
        .text(gtPaisa > 0 ? gtPaisa.toString() : '', 430, currentY);

      currentY += 35;

      // In Words
      const amountInWords = numberToWords(Math.floor(grandTotal));
      doc.fontSize(10).font('Helvetica')
        .text(`In Words: ${amountInWords} Rupees Only.`, 50, currentY, {
          width: 500,
          align: 'left'
        });

      // Signatures
      doc.fontSize(10).font('Helvetica')
        .text('Accountant', 80, 730)
        .text('Principal', 450, 730);

      // Horizontal line above signatures
      doc.moveTo(50, 720).lineTo(200, 720).stroke();
      doc.moveTo(420, 720).lineTo(550, 720).stroke();

      // Finalize PDF
      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate Student-Specific Exam Routine Notice with Fee Bill
 * @param {Object} data - Contains exam, student, routine, and feeTransaction
 * @param {string} outputPath - Path where PDF will be saved
 */
export async function generateStudentExamNotice(data, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const { exam, student, studentRoutine, feeTransaction, family } = data;

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Border
      doc.rect(30, 30, 535, 750).stroke();

      // School Header
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('SHINING STAR ENGLISH SCHOOL', 50, 50, { align: 'center' })
        .moveDown(0.3);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Ranjha-09, Mahottari', 50, 80, { align: 'center' })
        .text('Phone: [School Phone]', 50, 95, { align: 'center' })
        .moveDown(1);

      // Horizontal line
      doc
        .strokeColor('#000000')
        .lineWidth(2)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke()
        .moveDown(0.5);

      // Title
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('EXAMINATION NOTICE', { align: 'center', underline: true })
        .moveDown(1);

      // Student Information Box
      doc.rect(50, doc.y, 495, 90).stroke();
      const infoY = doc.y + 10;

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Student Name: ', 60, infoY, { continued: true })
        .font('Helvetica')
        .text(student.name)
        .moveDown(0.5);

      doc
        .font('Helvetica-Bold')
        .text('Student ID: ', 60, doc.y, { continued: true })
        .font('Helvetica')
        .text(student.studentId, { continued: true })
        .font('Helvetica-Bold')
        .text('     Class: ', { continued: true })
        .font('Helvetica')
        .text(student.currentClass.className)
        .moveDown(0.5);

      doc
        .font('Helvetica-Bold')
        .text('Roll No: ', 60, doc.y, { continued: true })
        .font('Helvetica')
        .text(student.rollNumber?.toString() || 'N/A', { continued: true })
        .font('Helvetica-Bold')
        .text('     Contact: ', { continued: true })
        .font('Helvetica')
        .text(student.guardianPhone || 'N/A')
        .moveDown(0.5);

      if (family) {
        doc
          .font('Helvetica-Bold')
          .text('Family: ', 60, doc.y, { continued: true })
          .font('Helvetica')
          .text(`${family.familyId} (${family.billingType} Billing)`)
          .moveDown(1);
      } else {
        doc.moveDown(1);
      }

      // Exam Details
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Exam Name: ', 50, doc.y, { continued: true })
        .font('Helvetica')
        .text(exam.examName)
        .moveDown(0.3);

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Type: ', 50, doc.y, { continued: true })
        .font('Helvetica')
        .text(exam.examType + (exam.terminalNumber ? ` - Terminal ${exam.terminalNumber}` : ''), { continued: true })
        .font('Helvetica-Bold')
        .text('     Academic Year: ', { continued: true })
        .font('Helvetica')
        .text(exam.academicYear)
        .moveDown(0.3);

      doc
        .font('Helvetica-Bold')
        .text('Exam Period: ', 50, doc.y, { continued: true })
        .font('Helvetica')
        .text(`${formatDate(exam.startDate)} to ${formatDate(exam.endDate)}`)
        .moveDown(1.5);

      // Exam Routine Section
      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .fillColor('#1a1a1a')
        .text('YOUR EXAMINATION ROUTINE', 50, doc.y, { underline: true })
        .moveDown(0.8);

      // Table headers
      const tableTop = doc.y;
      const col1X = 70;
      const col2X = 170;
      const col3X = 340;
      const col4X = 460;

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Date', col1X, tableTop)
        .text('Subject', col2X, tableTop)
        .text('Time', col3X, tableTop)
        .text('Duration', col4X, tableTop);

      doc
        .moveTo(50, tableTop + 15)
        .lineTo(545, tableTop + 15)
        .stroke();

      let currentY = tableTop + 25;

      // Sort entries by date
      studentRoutine.sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

      // Table rows
      studentRoutine.forEach((entry) => {
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(formatDate(entry.examDate), col1X, currentY, { width: 90 })
          .text(entry.subject.subjectName, col2X, currentY, { width: 160 })
          .text(`${entry.startTime} - ${entry.endTime}`, col3X, currentY, { width: 110 })
          .text(`${entry.duration} min`, col4X, currentY, { width: 70 });

        currentY += 18;
      });

      doc.moveDown(2);

      // Fee Bill Section
      if (doc.y > 550) {
        doc.addPage();
        doc.rect(30, 30, 535, 750).stroke();
      }

      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .fillColor('#1a1a1a')
        .text('EXAMINATION FEE BILL', 50, doc.y, { underline: true })
        .moveDown(0.8);

      // Bill Number and Date
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Bill No: ', 50, doc.y, { continued: true })
        .font('Helvetica')
        .text(feeTransaction.billNumber, { continued: true })
        .font('Helvetica-Bold')
        .text('     Date: ', { continued: true })
        .font('Helvetica')
        .text(formatDate(feeTransaction.date))
        .moveDown(1);

      // Fee Table
      const feeTableTop = doc.y;
      doc.rect(50, feeTableTop, 495, 25).stroke();

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('S.No.', 60, feeTableTop + 8)
        .text('Particulars', 140, feeTableTop + 8)
        .text('Amount (Rs.)', 420, feeTableTop + 8);

      let feeY = feeTableTop + 30;

      feeTransaction.feeBreakdown.forEach((item, index) => {
        doc.rect(50, feeY - 5, 495, 20).stroke();
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(`${index + 1}.`, 60, feeY)
          .text(item.feeType, 140, feeY, { width: 260 })
          .text(item.amount.toFixed(2), 420, feeY);

        feeY += 20;
      });

      // Total Row
      doc.rect(50, feeY - 5, 495, 25).stroke();
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Total Amount', 140, feeY + 5)
        .text(feeTransaction.chargeAmount.toFixed(2), 420, feeY + 5);

      feeY += 30;

      // Previous Balance Info
      if (feeTransaction.previousBalance !== 0) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(`Previous Balance: Rs. ${feeTransaction.previousBalance.toFixed(2)}`, 50, feeY)
          .moveDown(0.3);
        feeY = doc.y;
      }

      // Current Balance
      doc
        .fontSize(11)
        .font('Helvetica-Bold');

      if (feeTransaction.totalDue > 0) {
        doc
          .fillColor('#CC0000')
          .text(`Total Amount Due: Rs. ${feeTransaction.totalDue.toFixed(2)}`, 50, feeY);
      } else if (feeTransaction.totalAdvance > 0) {
        doc
          .fillColor('#009900')
          .text(`Total Advance: Rs. ${feeTransaction.totalAdvance.toFixed(2)}`, 50, feeY);
      } else {
        doc
          .fillColor('#000000')
          .text('Account Balance: Clear', 50, feeY);
      }

      doc.fillColor('#000000').moveDown(2);

      // Payment Instructions
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('PAYMENT INSTRUCTIONS:', 50, doc.y)
        .moveDown(0.3)
        .fontSize(9)
        .font('Helvetica')
        .text('• Please submit the exam fee at the school office before the exam starts.', 50, doc.y)
        .text('• Keep this notice for your records.', 50, doc.y + 12)
        .text('• For family billing, payment can be made for all students together.', 50, doc.y + 24)
        .moveDown(2);

      // Important Instructions
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('EXAM INSTRUCTIONS:', 50, doc.y)
        .moveDown(0.3)
        .fontSize(9)
        .font('Helvetica')
        .text('1. Arrive 15 minutes before the exam starts.', 50, doc.y)
        .text('2. Bring your admit card and valid ID.', 50, doc.y + 12)
        .text('3. Electronic devices are strictly prohibited.', 50, doc.y + 24)
        .text('4. Maintain discipline during the examination.', 50, doc.y + 36)
        .moveDown(3);

      // Footer with signatures
      const footerY = doc.page.height - 100;
      doc
        .fontSize(9)
        .font('Helvetica')
        .text('____________________', 80, footerY)
        .text('Accountant', 90, footerY + 15)
        .text('____________________', 400, footerY)
        .text('Principal', 420, footerY + 15);

      // Finalize PDF
      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate Payment Receipt PDF (like payment receipt template)
 * @param {Object} receiptData - Receipt information
 * @param {string} outputPath - Path where PDF will be saved
 */
export async function generatePaymentReceipt(receiptData, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Create PDF document - half page size for receipt
      const doc = new PDFDocument({ size: [595, 400], margin: 40 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Border with red color theme
      doc.rect(30, 30, 535, 340).stroke('#CC0000');

      // Header - Red background box
      doc.rect(30, 30, 535, 60).fillAndStroke('#CC0000', '#CC0000');

      // School Name in white
      doc.fontSize(16).font('Helvetica-Bold')
        .fillColor('#FFFFFF')
        .text('SHINING STAR ENGLISH SCHOOL', 50, 45, { align: 'center' });

      // School Address in white
      doc.fontSize(9).font('Helvetica')
        .text('Yangwarak-4, Tharpu, Panchthar', 50, 65, { align: 'center' })
        .text('Estd: 2051 (B.S.)', 50, 78, { align: 'center' });

      // Reset text color to black
      doc.fillColor('#000000');

      // Receipt Number
      doc.fontSize(16).font('Helvetica-Bold')
        .text(`R.No.`, 50, 110)
        .fontSize(20)
        .fillColor('#CC0000')
        .text(receiptData.receiptNumber || '1', 110, 108);

      doc.fillColor('#000000');

      // Received with thanks text
      doc.fontSize(11).font('Helvetica')
        .text('Received with thanks from Master/Miss', 50, 150);

      // Student/Family Name
      doc.fontSize(12).font('Helvetica-Bold')
        .text(receiptData.receivedFrom || '', 270, 149);

      // Amount text
      doc.fontSize(11).font('Helvetica')
        .text('an amount of Rs.', 50, 180);

      // Amount value
      doc.fontSize(12).font('Helvetica-Bold')
        .text(receiptData.paidAmount.toString(), 160, 179);

      // Amount in words
      const amountInWords = numberToWords(Math.floor(receiptData.paidAmount));
      doc.fontSize(11).font('Helvetica')
        .text('(In words Rupees', 240, 180);

      doc.fontSize(11).font('Helvetica-Bold')
        .text(amountInWords, 50, 200, { width: 500 })
        .font('Helvetica')
        .text('only)', 520, 200, { continued: false });

      // Out of Rs. text
      doc.fontSize(11).font('Helvetica')
        .text('out of Rs.', 50, 230);

      // Total due amount
      doc.fontSize(12).font('Helvetica-Bold')
        .text(receiptData.outOfAmount?.toString() || receiptData.paidAmount.toString(), 115, 229);

      // Months text
      doc.fontSize(11).font('Helvetica')
        .text(`for the months of ${receiptData.feeMonths || ''}`, 200, 230);

      // Two boxes for Paid and Balance
      const boxY = 270;

      // Paid Rs. box
      doc.rect(80, boxY, 180, 50).stroke('#CC0000');
      doc.fontSize(10).font('Helvetica-Bold')
        .fillColor('#CC0000')
        .text('Paid Rs.', 90, boxY + 10);

      doc.fontSize(14).font('Helvetica-Bold')
        .fillColor('#000000')
        .text(receiptData.paidAmount.toString(), 90, boxY + 28);

      // Balance Rs. box
      doc.rect(335, boxY, 180, 50).stroke('#CC0000');
      doc.fontSize(10).font('Helvetica-Bold')
        .fillColor('#CC0000')
        .text('Balance Rs.', 345, boxY + 10);

      const balance = (receiptData.balanceAmount !== undefined)
        ? receiptData.balanceAmount
        : (receiptData.outOfAmount || 0) - receiptData.paidAmount;

      doc.fontSize(14).font('Helvetica-Bold')
        .fillColor('#000000')
        .text(balance.toString(), 345, boxY + 28);

      // Accountant signature
      doc.fontSize(10).font('Helvetica')
        .text('Accountant', 440, 345);

      // Horizontal line above signature
      doc.moveTo(420, 340).lineTo(550, 340).stroke();

      // Finalize PDF
      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}
