import PDFDocument from 'pdfkit';
import { formatBSDate, formatBSDateShort } from './nepaliDate.js';

// NOTE: generateDemandBill, generatePaymentReceipt and generateFamilyStatement
// have been removed.  Fee PDFs are now generated entirely in the browser via
// @react-pdf/renderer (client/src/components/pdf/).

function collectPDFBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export async function generateExamNoticePDF(exam) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const bufferPromise = collectPDFBuffer(doc);

  doc.fontSize(24).font('Helvetica-Bold')
    .text('SHINING STAR ENGLISH SCHOOL', { align: 'center' }).moveDown(0.3);

  doc.fontSize(12).font('Helvetica')
    .text('Ranjha-09, Mahottari', { align: 'center' })
    .text('Phone: [School Phone]', { align: 'center' }).moveDown(1);

  doc.strokeColor('#000000').lineWidth(2)
    .moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(1);

  doc.fontSize(18).font('Helvetica-Bold')
    .text('EXAMINATION NOTICE', { align: 'center', underline: true }).moveDown(1);

  doc.fontSize(12).font('Helvetica-Bold').text('Exam Name: ', { continued: true })
    .font('Helvetica').text(exam.examName).moveDown(0.5);

  doc.font('Helvetica-Bold').text('Terminal: ', { continued: true })
    .font('Helvetica').text(`Terminal ${exam.terminalNumber}`).moveDown(0.5);

  doc.font('Helvetica-Bold').text('Academic Year: ', { continued: true })
    .font('Helvetica').text(exam.academicYear).moveDown(0.5);

  doc.font('Helvetica-Bold').text('Exam Period: ', { continued: true })
    .font('Helvetica').text(`${formatDate(exam.startDate)} to ${formatDate(exam.endDate)}`).moveDown(1.5);

  doc.fontSize(14).font('Helvetica-Bold')
    .text('EXAMINATION ROUTINE', { align: 'center', underline: true }).moveDown(1);

  const routineByClass = {};
  exam.routine.forEach(entry => {
    const className = entry.class.className;
    if (!routineByClass[className]) routineByClass[className] = [];
    routineByClass[className].push(entry);
  });

  Object.keys(routineByClass).sort().forEach((className, index) => {
    if (index > 0 && doc.y > 650) doc.addPage();

    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a1a1a')
      .text(`Class: ${className}`, { underline: true }).moveDown(0.5);

    const tableTop = doc.y;
    const col1X = 70, col2X = 200, col3X = 370, col4X = 470;

    doc.fontSize(11).font('Helvetica-Bold')
      .text('Date', col1X, tableTop).text('Subject', col2X, tableTop)
      .text('Time', col3X, tableTop).text('Duration', col4X, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    let currentY = tableTop + 25;
    routineByClass[className].sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

    routineByClass[className].forEach(entry => {
      doc.fontSize(10).font('Helvetica')
        .text(formatDate(entry.examDate), col1X, currentY, { width: 120 })
        .text(entry.subject.subjectName, col2X, currentY, { width: 160 })
        .text(`${entry.startTime} - ${entry.endTime}`, col3X, currentY, { width: 90 })
        .text(`${entry.duration} min`, col4X, currentY, { width: 60 });

      currentY += 20;
      if (currentY > 700) { doc.addPage(); currentY = 50; }
    });

    doc.moveDown(2);
  });

  if (doc.y > 600) doc.addPage();

  doc.moveDown(2).fontSize(12).font('Helvetica-Bold')
    .text('IMPORTANT INSTRUCTIONS:', { underline: true }).moveDown(0.5)
    .fontSize(10).font('Helvetica')
    .text('1. Students must arrive 15 minutes before the exam starts.')
    .text('2. Students must bring their admit card and valid ID.')
    .text('3. Electronic devices (mobile phones, calculators, etc.) are strictly prohibited.')
    .text('4. Students must maintain discipline during the examination.')
    .text('5. Students caught using unfair means will be disqualified.')
    .moveDown(2);

  const footerY = doc.page.height - 100;
  doc.fontSize(10).font('Helvetica-Bold')
    .text('____________________', 350, footerY)
    .text("Principal's Signature", 350, footerY + 15, { align: 'left' })
    .moveDown(0.5).fontSize(9).font('Helvetica')
    .text(`Date: ${formatDate(new Date())}`, 350, footerY + 35);

  doc.end();
  return bufferPromise;
}

export async function generateProgressReportPDF(progressReport) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const bufferPromise = collectPDFBuffer(doc);

  doc.fontSize(22).font('Helvetica-Bold')
    .text('SHINING STAR ENGLISH SCHOOL', { align: 'center' }).moveDown(0.3);
  doc.fontSize(11).font('Helvetica')
    .text('Ranjha-09, Mahottari', { align: 'center' }).moveDown(0.8);

  doc.fontSize(16).font('Helvetica-Bold')
    .text('PROGRESS REPORT', { align: 'center', underline: true }).moveDown(0.5);
  doc.fontSize(11).font('Helvetica')
    .text(`Academic Year: ${progressReport.academicYear}`, { align: 'center' }).moveDown(1);

  doc.rect(50, doc.y, 495, 80).stroke();
  const infoY = doc.y + 10;

  doc.fontSize(10).font('Helvetica-Bold')
    .text('Student Name: ', 60, infoY, { continued: true })
    .font('Helvetica').text(progressReport.student.name).moveDown(0.5);

  doc.font('Helvetica-Bold').text('Student ID: ', 60, doc.y, { continued: true })
    .font('Helvetica').text(progressReport.student.studentId, { continued: true })
    .font('Helvetica-Bold').text('     Roll No: ', { continued: true })
    .font('Helvetica').text(progressReport.student.rollNumber?.toString() || 'N/A').moveDown(0.5);

  doc.font('Helvetica-Bold').text('Class: ', 60, doc.y, { continued: true })
    .font('Helvetica').text(progressReport.class.className, { continued: true })
    .font('Helvetica-Bold').text('     Date of Birth: ', { continued: true })
    .font('Helvetica').text(formatDate(progressReport.student.dateOfBirth)).moveDown(1.5);

  doc.fontSize(12).font('Helvetica-Bold')
    .text('TERMINAL EXAMINATION RESULTS', { align: 'center', underline: true }).moveDown(1);

  progressReport.terminals.forEach(terminal => {
    if (doc.y > 650) doc.addPage();

    doc.fontSize(11).font('Helvetica-Bold')
      .text(`Terminal ${terminal.terminalNumber}`, { underline: true }).moveDown(0.3);

    if (!terminal.marks) {
      doc.fontSize(10).font('Helvetica').text('Not yet completed').moveDown(1);
      return;
    }

    doc.fontSize(10).font('Helvetica-Bold').text('GPA: ', { continued: true })
      .font('Helvetica').text(`${terminal.gpa.toFixed(2)}`, { continued: true })
      .font('Helvetica-Bold').text('     Grade: ', { continued: true })
      .font('Helvetica').text(terminal.grade).moveDown(0.3);

    doc.font('Helvetica-Bold').text('Attendance: ', { continued: true })
      .font('Helvetica')
      .text(`${terminal.attendance.present}/${terminal.attendance.totalDays} (${terminal.attendance.percentage}%)`)
      .moveDown(1);
  });

  if (doc.y > 650) doc.addPage();

  doc.moveDown(1).fontSize(12).font('Helvetica-Bold').fillColor('#000000')
    .text('YEARLY SUMMARY', { align: 'center', underline: true }).moveDown(0.8);

  doc.fontSize(11).font('Helvetica-Bold').text('Overall GPA: ', { continued: true })
    .font('Helvetica').text(`${progressReport.yearlyTotal.gradePoint.toFixed(2)}`, { continued: true })
    .font('Helvetica-Bold').text('     Overall Grade: ', { continued: true })
    .font('Helvetica').text(progressReport.yearlyTotal.grade).moveDown(2);

  const signY = doc.page.height - 120;
  doc.fontSize(10).font('Helvetica-Bold')
    .text('____________________', 60, signY).text('Class Teacher', 60, signY + 15)
    .text('____________________', 250, signY).text('Principal', 250, signY + 15)
    .text('____________________', 440, signY).text('Parent/Guardian', 440, signY + 15);

  doc.end();
  return bufferPromise;
}

export async function generateStudentExamNotice(data) {
  const { exam, student, studentRoutine, feeTransaction, family } = data;
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const bufferPromise = collectPDFBuffer(doc);

  doc.rect(30, 30, 535, 750).stroke();
  doc.fontSize(22).font('Helvetica-Bold')
    .text('SHINING STAR ENGLISH SCHOOL', 50, 50, { align: 'center' }).moveDown(0.3);
  doc.fontSize(10).font('Helvetica')
    .text('Ranjha-09, Mahottari', 50, 80, { align: 'center' })
    .text('Phone: [School Phone]', 50, 95, { align: 'center' }).moveDown(1);

  doc.strokeColor('#000000').lineWidth(2)
    .moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.5);

  doc.fontSize(16).font('Helvetica-Bold')
    .text('EXAMINATION NOTICE', { align: 'center', underline: true }).moveDown(1);

  doc.rect(50, doc.y, 495, 90).stroke();
  const infoY = doc.y + 10;

  doc.fontSize(10).font('Helvetica-Bold').text('Student Name: ', 60, infoY, { continued: true })
    .font('Helvetica').text(student.name).moveDown(0.5);

  doc.font('Helvetica-Bold').text('Student ID: ', 60, doc.y, { continued: true })
    .font('Helvetica').text(student.studentId, { continued: true })
    .font('Helvetica-Bold').text('     Class: ', { continued: true })
    .font('Helvetica').text(student.currentClass.className).moveDown(0.5);

  doc.font('Helvetica-Bold').text('Roll No: ', 60, doc.y, { continued: true })
    .font('Helvetica').text(student.rollNumber?.toString() || 'N/A', { continued: true })
    .font('Helvetica-Bold').text('     Contact: ', { continued: true })
    .font('Helvetica').text(student.guardianPhone || 'N/A').moveDown(0.5);

  if (family) {
    doc.font('Helvetica-Bold').text('Family: ', 60, doc.y, { continued: true })
      .font('Helvetica').text(family.familyId).moveDown(1);
  } else {
    doc.moveDown(1);
  }

  doc.fontSize(12).font('Helvetica-Bold').text('Exam Name: ', 50, doc.y, { continued: true })
    .font('Helvetica').text(exam.examName).moveDown(0.3);

  doc.fontSize(10).font('Helvetica-Bold').text('Terminal: ', 50, doc.y, { continued: true })
    .font('Helvetica').text(`Terminal ${exam.terminalNumber}`, { continued: true })
    .font('Helvetica-Bold').text('     Academic Year: ', { continued: true })
    .font('Helvetica').text(exam.academicYear).moveDown(0.3);

  doc.font('Helvetica-Bold').text('Exam Period: ', 50, doc.y, { continued: true })
    .font('Helvetica').text(`${formatDate(exam.startDate)} to ${formatDate(exam.endDate)}`).moveDown(1.5);

  doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a1a1a')
    .text('YOUR EXAMINATION ROUTINE', 50, doc.y, { underline: true }).moveDown(0.8);

  const tableTop = doc.y;
  const col1X = 70, col2X = 170, col3X = 340, col4X = 460;

  doc.fontSize(10).font('Helvetica-Bold')
    .text('Date', col1X, tableTop).text('Subject', col2X, tableTop)
    .text('Time', col3X, tableTop).text('Duration', col4X, tableTop);

  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

  let currentY = tableTop + 25;
  studentRoutine.sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

  studentRoutine.forEach(entry => {
    doc.fontSize(9).font('Helvetica')
      .text(formatDate(entry.examDate), col1X, currentY, { width: 90 })
      .text(entry.subject.subjectName, col2X, currentY, { width: 160 })
      .text(`${entry.startTime} - ${entry.endTime}`, col3X, currentY, { width: 110 })
      .text(`${entry.duration} min`, col4X, currentY, { width: 70 });
    currentY += 18;
  });

  doc.moveDown(2);

  if (doc.y > 550) {
    doc.addPage();
    doc.rect(30, 30, 535, 750).stroke();
  }

  doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a1a1a')
    .text('EXAMINATION FEE BILL', 50, doc.y, { underline: true }).moveDown(0.8);

  doc.fontSize(10).font('Helvetica-Bold').text('Bill No: ', 50, doc.y, { continued: true })
    .font('Helvetica').text(feeTransaction.billNumber, { continued: true })
    .font('Helvetica-Bold').text('     Date: ', { continued: true })
    .font('Helvetica').text(formatDate(feeTransaction.date)).moveDown(1);

  const feeTableTop = doc.y;
  doc.rect(50, feeTableTop, 495, 25).stroke();
  doc.fontSize(10).font('Helvetica-Bold')
    .text('S.No.', 60, feeTableTop + 8)
    .text('Particulars', 140, feeTableTop + 8)
    .text('Amount (Rs.)', 420, feeTableTop + 8);

  let feeY = feeTableTop + 30;
  feeTransaction.feeBreakdown.forEach((item, index) => {
    doc.rect(50, feeY - 5, 495, 20).stroke();
    doc.fontSize(9).font('Helvetica')
      .text(`${index + 1}.`, 60, feeY).text(item.feeType, 140, feeY, { width: 260 })
      .text(item.amount.toFixed(2), 420, feeY);
    feeY += 20;
  });

  doc.rect(50, feeY - 5, 495, 25).stroke();
  doc.fontSize(10).font('Helvetica-Bold')
    .text('Total Amount', 140, feeY + 5)
    .text(feeTransaction.chargeAmount.toFixed(2), 420, feeY + 5);
  feeY += 30;

  if (feeTransaction.previousBalance !== 0) {
    doc.fontSize(9).font('Helvetica')
      .text(`Previous Balance: Rs. ${feeTransaction.previousBalance.toFixed(2)}`, 50, feeY)
      .moveDown(0.3);
    feeY = doc.y;
  }

  doc.fontSize(11).font('Helvetica-Bold');
  if (feeTransaction.totalDue > 0) {
    doc.fillColor('#CC0000').text(`Total Amount Due: Rs. ${feeTransaction.totalDue.toFixed(2)}`, 50, feeY);
  } else if (feeTransaction.totalAdvance > 0) {
    doc.fillColor('#009900').text(`Total Advance: Rs. ${feeTransaction.totalAdvance.toFixed(2)}`, 50, feeY);
  } else {
    doc.fillColor('#000000').text('Account Balance: Clear', 50, feeY);
  }
  doc.fillColor('#000000').moveDown(2);

  doc.fontSize(10).font('Helvetica-Bold').text('PAYMENT INSTRUCTIONS:', 50, doc.y).moveDown(0.3)
    .fontSize(9).font('Helvetica')
    .text('• Please submit the exam fee at the school office before the exam starts.', 50, doc.y)
    .text('• Keep this notice for your records.', 50, doc.y + 12)
    .text('• For family billing, payment can be made for all students together.', 50, doc.y + 24)
    .moveDown(2);

  doc.fontSize(10).font('Helvetica-Bold').text('EXAM INSTRUCTIONS:', 50, doc.y).moveDown(0.3)
    .fontSize(9).font('Helvetica')
    .text('1. Arrive 15 minutes before the exam starts.', 50, doc.y)
    .text('2. Bring your admit card and valid ID.', 50, doc.y + 12)
    .text('3. Electronic devices are strictly prohibited.', 50, doc.y + 24)
    .text('4. Maintain discipline during the examination.', 50, doc.y + 36)
    .moveDown(3);

  const footerY = doc.page.height - 100;
  doc.fontSize(9).font('Helvetica')
    .text('____________________', 80, footerY).text('Accountant', 90, footerY + 15)
    .text('____________________', 400, footerY).text('Principal', 420, footerY + 15);

  doc.end();
  return bufferPromise;
}

// ── Private helpers ──────────────────────────────────────────────────────────

// All dates in generated PDFs are Bikram Sambat (BS / Nepali calendar).
function formatDate(date) {
  if (!date) return 'N/A';
  return formatBSDate(date);
}
