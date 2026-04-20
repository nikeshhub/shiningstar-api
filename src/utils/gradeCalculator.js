/**
 * Nepal NEB Grading System
 * Converts percentage marks to grade point (0-4) and grade letter
 */

/**
 * Calculate grade based on NEB system
 * @param {number} obtainedMarks - Marks obtained by student
 * @param {number} fullMarks - Total marks possible
 * @returns {object} - { percentage, gradePoint, gradeLetter }
 */
export function calculateGrade(obtainedMarks, fullMarks) {
  if (!obtainedMarks || !fullMarks || fullMarks === 0) {
    return {
      percentage: 0,
      gradePoint: 0.0,
      gradeLetter: 'NG'
    };
  }

  const percentage = (obtainedMarks / fullMarks) * 100;

  let gradePoint, gradeLetter;

  if (percentage >= 90) {
    gradePoint = 4.0;
    gradeLetter = 'A+';
  } else if (percentage >= 80) {
    gradePoint = 3.6;
    gradeLetter = 'A';
  } else if (percentage >= 70) {
    gradePoint = 3.2;
    gradeLetter = 'B+';
  } else if (percentage >= 60) {
    gradePoint = 2.8;
    gradeLetter = 'B';
  } else if (percentage >= 50) {
    gradePoint = 2.4;
    gradeLetter = 'C+';
  } else if (percentage >= 40) {
    gradePoint = 2.0;
    gradeLetter = 'C';
  } else if (percentage >= 20) {
    gradePoint = 1.6;
    gradeLetter = 'D';
  } else {
    gradePoint = 0.0;
    gradeLetter = 'NG';
  }

  return {
    percentage: parseFloat(percentage.toFixed(2)),
    gradePoint,
    gradeLetter
  };
}

/**
 * Calculate GPA from multiple subjects
 * @param {array} subjectMarks - Array of subject marks with gradePoint
 * @returns {object} - { gpa, grade }
 */
export function calculateGPA(subjectMarks) {
  if (!subjectMarks || subjectMarks.length === 0) {
    return {
      gpa: 0.0,
      grade: 'NG'
    };
  }

  // Filter out absent students and calculate total grade points
  const validMarks = subjectMarks.filter(mark => !mark.isAbsent);

  if (validMarks.length === 0) {
    return {
      gpa: 0.0,
      grade: 'NG'
    };
  }

  const totalGradePoints = validMarks.reduce((sum, mark) => sum + (mark.gradePoint || 0), 0);
  const gpa = totalGradePoints / validMarks.length;

  // Convert GPA to grade letter
  let grade;
  if (gpa >= 3.6) {
    grade = 'A+';
  } else if (gpa >= 3.2) {
    grade = 'A';
  } else if (gpa >= 2.8) {
    grade = 'B+';
  } else if (gpa >= 2.4) {
    grade = 'B';
  } else if (gpa >= 2.0) {
    grade = 'C+';
  } else if (gpa >= 1.6) {
    grade = 'C';
  } else if (gpa >= 1.2) {
    grade = 'D';
  } else {
    grade = 'NG';
  }

  return {
    gpa: parseFloat(gpa.toFixed(2)),
    grade
  };
}

/**
 * Get applicable terminals for a class
 * @param {string} className - Name of the class
 * @returns {array} - Array of terminal numbers
 */
export function getApplicableTerminals(className) {
  const lowerClassName = className.toLowerCase();

  // Nursery has terminals 2, 3, 4 (skips terminal 1)
  if (lowerClassName.includes('nursery')) {
    return [2, 3, 4];
  }

  // All other classes have terminals 1, 2, 3, 4
  return [1, 2, 3, 4];
}

/**
 * Calculate marks from written and practical
 * @param {number} writtenMarks - Written marks obtained
 * @param {number} practicalMarks - Practical marks obtained
 * @returns {number} - Total marks
 */
export function calculateTotalMarks(writtenMarks = 0, practicalMarks = 0) {
  return parseFloat(writtenMarks) + parseFloat(practicalMarks);
}
