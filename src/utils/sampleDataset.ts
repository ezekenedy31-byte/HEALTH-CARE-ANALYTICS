import type { DatasetRole } from '../types/hospital';

interface DeptBlueprint {
  name: string;
  beds: number;
  docTarget: number;
  nurseTarget: number;
  supportTarget: number;
  rostered: number;
  baseDemand: number;
  baseAdmitRate: number;
  baseWait: number;
  diagnoses: string[];
}

const DEPARTMENTS: DeptBlueprint[] = [
  { name: 'Emergency', beds: 24, docTarget: 6, nurseTarget: 12, supportTarget: 6, rostered: 63, baseDemand: 19, baseAdmitRate: 0.21, baseWait: 52, diagnoses: ['Acute Trauma', 'Chest Pain', 'Respiratory Distress', 'Febrile Illness'] },
  { name: 'Cardiology', beds: 18, docTarget: 4, nurseTarget: 8, supportTarget: 4, rostered: 44, baseDemand: 13, baseAdmitRate: 0.24, baseWait: 39, diagnoses: ['Hypertensive Crisis', 'Arrhythmia', 'Heart Failure', 'Coronary Artery Disease'] },
  { name: 'Orthopedics', beds: 16, docTarget: 4, nurseTarget: 7, supportTarget: 4, rostered: 39, baseDemand: 11, baseAdmitRate: 0.22, baseWait: 44, diagnoses: ['Fracture Repair', 'Joint Degeneration', 'Lumbar Strain', 'Sports Injury'] },
  { name: 'Pediatrics', beds: 20, docTarget: 5, nurseTarget: 9, supportTarget: 5, rostered: 49, baseDemand: 15, baseAdmitRate: 0.18, baseWait: 36, diagnoses: ['Pediatric Fever', 'Bronchiolitis', 'Gastroenteritis', 'Asthma Exacerbation'] },
  { name: 'Oncology', beds: 14, docTarget: 4, nurseTarget: 8, supportTarget: 4, rostered: 41, baseDemand: 9, baseAdmitRate: 0.20, baseWait: 31, diagnoses: ['Chemotherapy Cycle', 'Neutropenic Fever', 'Palliative Care', 'Tumor Staging'] },
  { name: 'General Surgery', beds: 18, docTarget: 5, nurseTarget: 9, supportTarget: 4, rostered: 48, baseDemand: 13, baseAdmitRate: 0.25, baseWait: 41, diagnoses: ['Appendicitis', 'Cholecystitis', 'Hernia Repair', 'Post-Op Follow-Up'] },
  { name: 'Internal Medicine', beds: 22, docTarget: 5, nurseTarget: 10, supportTarget: 5, rostered: 57, baseDemand: 16, baseAdmitRate: 0.22, baseWait: 38, diagnoses: ['Diabetes Mellitus', 'Pneumonia', 'Sepsis Workup', 'Anemia'] },
  { name: 'Maternity', beds: 20, docTarget: 5, nurseTarget: 10, supportTarget: 5, rostered: 50, baseDemand: 14, baseAdmitRate: 0.26, baseWait: 28, diagnoses: ['Normal Delivery', 'Cesarean Section', 'Pre-Eclampsia', 'Prenatal Monitoring'] },
  { name: 'Neurology', beds: 12, docTarget: 3, nurseTarget: 6, supportTarget: 3, rostered: 31, baseDemand: 8, baseAdmitRate: 0.21, baseWait: 43, diagnoses: ['Acute Stroke', 'Seizure Disorder', 'Migraine Status', 'Neuropathy'] },
  { name: 'Nephrology', beds: 14, docTarget: 3, nurseTarget: 6, supportTarget: 3, rostered: 33, baseDemand: 10, baseAdmitRate: 0.19, baseWait: 35, diagnoses: ['Dialysis Session', 'Acute Kidney Injury', 'CKD Stage 4', 'Electrolyte Imbalance'] },
];

const FIRST_NAMES_F = ['Amina', 'Chidinma', 'Folake', 'Ngozi', 'Zainab', 'Bisi', 'Ifeoma', 'Hauwa', 'Tolu', 'Kemi', 'Adaeze', 'Sade', 'Yemi', 'Rukayat', 'Nneka'];
const FIRST_NAMES_M = ['Chinedu', 'Tunde', 'Ibrahim', 'Emeka', 'Segun', 'Musa', 'Kelechi', 'Damilola', 'Uche', 'Yusuf', 'Femi', 'Obinna', 'Babatunde', 'Sadiq', 'Nnamdi'];
const LAST_NAMES = ['Okafor', 'Adeyemi', 'Bello', 'Nwosu', 'Adebayo', 'Ibrahim', 'Eze', 'Balogun', 'Okonkwo', 'Suleiman', 'Ogunleye', 'Chukwu', 'Lawal', 'Abubakar', 'Akinola'];
const INSURANCES = ['NHIS', 'Private HMO', 'Out-of-Pocket', 'Corporate Plan'];
const DISCHARGE_STATUSES = ['Discharged Home', 'Discharged Home', 'Discharged Home', 'Discharged Home', 'Transferred', 'Left AMA', 'Follow-Up Outpatient'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function generateBaselineCsvFiles(): Record<DatasetRole, { fileName: string; csvText: string }> {
  const rng = createRng(20250101);

  // 1. Department Targets CSV (10 rows)
  const targetLines = [
    'Department,TotalBeds,DoctorsPerShift_Target,NursesPerShift_Target,SupportStaffPerShift_Target,TotalRosteredStaff',
    ...DEPARTMENTS.map(
      (d) => `${d.name},${d.beds},${d.docTarget},${d.nurseTarget},${d.supportTarget},${d.rostered}`
    ),
  ];

  // 2. Staff Roster CSV (455 rows: ST-1001 to ST-1455)
  const staffLines = ['StaffID,StaffName,Gender,Role,Department,EmploymentType,YearsExperience'];
  let staffNum = 1001;
  for (const dept of DEPARTMENTS) {
    const docsCount = Math.round(dept.rostered * 0.22);
    const nursesCount = Math.round(dept.rostered * 0.53);
    const supportCount = dept.rostered - docsCount - nursesCount;
    const rolePool: string[] = [
      ...Array(docsCount).fill('Doctor'),
      ...Array(nursesCount).fill('Nurse'),
      ...Array(supportCount).fill('Support Staff'),
    ];
    for (const role of rolePool) {
      const isFemale = rng() < (role === 'Nurse' ? 0.72 : 0.45);
      const first = isFemale
        ? FIRST_NAMES_F[Math.floor(rng() * FIRST_NAMES_F.length)]
        : FIRST_NAMES_M[Math.floor(rng() * FIRST_NAMES_M.length)];
      const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
      const empRoll = rng();
      const empType = empRoll < 0.72 ? 'Full-Time' : empRoll < 0.90 ? 'Part-Time' : 'Locum';
      const years = Math.max(1, Math.min(28, Math.round(2 + rng() * 19)));
      const prefix = role === 'Doctor' ? 'Dr. ' : '';
      staffLines.push(
        `ST-${staffNum},${prefix}${first} ${last},${isFemale ? 'Female' : 'Male'},${role},${dept.name},${empType},${years}`
      );
      staffNum++;
    }
  }

  // Build physician lookup per department for patient encounters
  const deptPhysicians: Record<string, string[]> = {};
  for (let i = 1; i < staffLines.length; i++) {
    const parts = staffLines[i].split(',');
    if (parts[3] === 'Doctor') {
      const dept = parts[4];
      if (!deptPhysicians[dept]) deptPhysicians[dept] = [];
      deptPhysicians[dept].push(parts[1]);
    }
  }

  // 3. Daily Department Operations CSV (3,650 rows: 2025-01-01 to 2025-12-31)
  const dailyLines = [
    'Date,DayOfWeek,IsWeekend,Department,PatientsAdmitted,PatientsDischarged,PatientsHandled_Total,DoctorsOnDuty,NursesOnDuty,SupportStaffOnDuty,BedsAvailable,BedsOccupied,BedOccupancyRate_%,PatientToStaffRatio,AvgWaitTime_Minutes,OvertimeHours_Logged,OperationalEfficiencyScore',
  ];

  const startDate = new Date(Date.UTC(2025, 0, 1));
  for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
    const currentDate = addDays(startDate, dayOffset);
    const dateStr = formatDate(currentDate);
    const dowIdx = currentDate.getUTCDay();
    const dowName = DAY_NAMES[dowIdx];
    const isWeekend = dowIdx === 0 || dowIdx === 6;
    const month = currentDate.getUTCMonth(); // 0..11

    // Mild seasonal wave (higher respiratory/fever in rainy/harmattan peaks + modest year growth)
    const seasonalWave = 1 + 0.12 * Math.sin((2 * Math.PI * (dayOffset - 20)) / 365) + 0.08 * (dayOffset / 365);
    const dowFactor = dowIdx === 1 ? 1.18 : dowIdx === 2 || dowIdx === 3 ? 1.07 : isWeekend ? 0.84 : 1.0;

    for (const dept of DEPARTMENTS) {
      const weekendDeptFactor = dept.name === 'Emergency' || dept.name === 'Maternity' ? (isWeekend ? 1.04 : 1.0) : dowFactor;
      const noise = 0.82 + rng() * 0.38;
      const handled = Math.max(4, Math.round(dept.baseDemand * seasonalWave * weekendDeptFactor * noise));
      const admitted = Math.max(0, Math.min(6, Math.round(handled * dept.baseAdmitRate * (0.7 + rng() * 0.6))));
      const discharged = Math.max(0, Math.min(6, Math.round(admitted * (0.85 + rng() * 0.35))));

      // Shift staffing with occasional realistic shortages on weekends / high-load periods
      const shortageDip = (isWeekend && rng() < 0.32) || (month >= 6 && month <= 8 && rng() < 0.22);
      const docOnDuty = Math.max(1, dept.docTarget - (shortageDip ? (rng() < 0.65 ? 1 : 2) : rng() < 0.14 ? 1 : 0));
      const nurseOnDuty = Math.max(3, dept.nurseTarget - (shortageDip ? (rng() < 0.6 ? 2 : 1) : rng() < 0.18 ? 1 : 0));
      const supportOnDuty = Math.max(2, dept.supportTarget - (shortageDip && rng() < 0.5 ? 1 : 0));
      const totalStaff = docOnDuty + nurseOnDuty + supportOnDuty;

      // Bed occupancy driven by demand + seasonal pressure
      const rawOccupancyPct = Math.min(
        100,
        Math.max(
          42,
          Number(((0.62 + 0.24 * seasonalWave + (handled / (dept.baseDemand * 1.6)) * 0.12 + (rng() - 0.5) * 0.14) * 100).toFixed(1))
        )
      );
      const bedsOccupied = Math.min(dept.beds, Math.max(4, Math.round((rawOccupancyPct / 100) * dept.beds)));
      const bedsAvailable = dept.beds - bedsOccupied;
      const actualOccPct = Number(((bedsOccupied / dept.beds) * 100).toFixed(1));

      const ratio = Number((handled / totalStaff).toFixed(2));
      const staffingStrain = Math.max(0, (dept.docTarget + dept.nurseTarget) - (docOnDuty + nurseOnDuty));
      const avgWait = Math.max(
        10,
        Math.round(dept.baseWait * (0.82 + (ratio / 1.1) * 0.24 + staffingStrain * 0.09 + (rng() - 0.5) * 0.25))
      );
      const overtime = 0.0; // Matches observed dataset behavior where OvertimeHours_Logged is 0.0
      const efficiency = Number(
        Math.max(
          54,
          Math.min(98, 92 - avgWait * 0.22 - staffingStrain * 3.1 - (actualOccPct > 90 ? 5.5 : 0) + (rng() - 0.5) * 6)
        ).toFixed(1)
      );

      dailyLines.push(
        [
          dateStr,
          dowName,
          isWeekend ? 'True' : 'False',
          dept.name,
          admitted,
          discharged,
          handled,
          docOnDuty,
          nurseOnDuty,
          supportOnDuty,
          bedsAvailable,
          bedsOccupied,
          actualOccPct.toFixed(1),
          ratio.toFixed(2),
          avgWait,
          overtime.toFixed(1),
          efficiency.toFixed(1),
        ].join(',')
      );
    }
  }

  // 4. Patient Encounters CSV (1,200 rows: PT-10001 to PT-11200)
  const patientLines = [
    'PatientID,PatientName,Age,Gender,Department,AttendingPhysician,ArrivalDate,ArrivalTime,DayOfWeek,TimeSeenByClinician,WaitTime_Minutes,ServiceDuration_Minutes,DischargeDate,LengthOfStay_Days,DiagnosisCategory,InsuranceType,TreatmentCost_NGN,ReadmittedWithin30Days,PatientSatisfactionScore,DischargeStatus',
  ];

  // Hour weights (peak morning 08:00-12:00 and late afternoon 15:00-19:00)
  const hourWeights = [
    1.2, 0.9, 0.7, 0.6, 0.8, 1.4, 2.5, 4.2, 6.8, 7.6, 7.4, 6.9,
    5.8, 5.2, 5.6, 6.2, 5.9, 4.8, 3.8, 3.1, 2.4, 1.9, 1.5, 1.3,
  ];
  const totalHourWeight = hourWeights.reduce((a, b) => a + b, 0);

  for (let i = 0; i < 1200; i++) {
    const pid = `PT-${10001 + i}`;
    const isFemale = rng() < 0.52;
    const first = isFemale
      ? FIRST_NAMES_F[Math.floor(rng() * FIRST_NAMES_F.length)]
      : FIRST_NAMES_M[Math.floor(rng() * FIRST_NAMES_M.length)];
    const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];

    // Pick department weighted by base demand
    const totalBase = DEPARTMENTS.reduce((s, d) => s + d.baseDemand, 0);
    let pick = rng() * totalBase;
    let dept = DEPARTMENTS[0];
    for (const candidate of DEPARTMENTS) {
      pick -= candidate.baseDemand;
      if (pick <= 0) {
        dept = candidate;
        break;
      }
    }

    const age = dept.name === 'Pediatrics' ? Math.max(1, Math.round(rng() * 16)) : Math.max(18, Math.min(89, Math.round(22 + rng() * 62)));
    const physicians = deptPhysicians[dept.name] || ['Dr. Adeyemi'];
    const physician = physicians[Math.floor(rng() * physicians.length)];

    const dayOffset = Math.floor(rng() * 365);
    const arrDateObj = addDays(startDate, dayOffset);
    const arrDateStr = formatDate(arrDateObj);
    const dowName = DAY_NAMES[arrDateObj.getUTCDay()];

    // Weighted arrival hour
    let hw = rng() * totalHourWeight;
    let arrHour = 9;
    for (let h = 0; h < 24; h++) {
      hw -= hourWeights[h];
      if (hw <= 0) {
        arrHour = h;
        break;
      }
    }
    const arrMin = Math.floor(rng() * 60);
    const arrTimeStr = `${pad2(arrHour)}:${pad2(arrMin)}`;

    // Wait time slightly longer during peak hours 9-12 & 16-18
    const peakMultiplier = (arrHour >= 9 && arrHour <= 12) || (arrHour >= 16 && arrHour <= 18) ? 1.18 : 0.94;
    const waitMins = Math.max(8, Math.min(135, Math.round(dept.baseWait * peakMultiplier * (0.6 + rng() * 0.9))));
    const seenTotalMins = (arrHour * 60 + arrMin + waitMins) % (24 * 60);
    const seenTimeStr = `${pad2(Math.floor(seenTotalMins / 60))}:${pad2(seenTotalMins % 60)}`;

    const serviceDuration = Math.max(20, Math.round(30 + rng() * 95));
    const losDays = rng() < 0.45 ? 0 : Math.max(1, Math.min(12, Math.round(1 + rng() * 6)));
    const disDateStr = formatDate(addDays(arrDateObj, losDays));

    const diag = dept.diagnoses[Math.floor(rng() * dept.diagnoses.length)];
    const insurance = INSURANCES[Math.floor(rng() * INSURANCES.length)];
    const costNgn = Math.round((25000 + losDays * 38000 + rng() * 145000) / 500) * 500;
    const readmitted = rng() < (dept.name === 'Emergency' || dept.name === 'Cardiology' ? 0.13 : 0.08) ? 'Yes' : 'No';
    const satisfaction = Number(Math.max(2.1, Math.min(5.0, 4.55 - waitMins / 110 + (rng() - 0.5) * 0.8)).toFixed(1));
    const dischargeStatus = DISCHARGE_STATUSES[Math.floor(rng() * DISCHARGE_STATUSES.length)];

    patientLines.push(
      [
        pid,
        `${first} ${last}`,
        age,
        isFemale ? 'Female' : 'Male',
        dept.name,
        physician,
        arrDateStr,
        arrTimeStr,
        dowName,
        seenTimeStr,
        waitMins,
        serviceDuration,
        disDateStr,
        losDays,
        diag,
        insurance,
        costNgn,
        readmitted,
        satisfaction.toFixed(1),
        dischargeStatus,
      ].join(',')
    );
  }

  return {
    dailyOps: { fileName: 'daily_department_operations_2025.csv', csvText: dailyLines.join('\n') },
    targets: { fileName: 'department_targets.csv', csvText: targetLines.join('\n') },
    patients: { fileName: 'patient_encounters_2025.csv', csvText: patientLines.join('\n') },
    staff: { fileName: 'staff_roster_2025.csv', csvText: staffLines.join('\n') },
  };
}
