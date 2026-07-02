'use strict';

const db = require('../db.js');

const NEW_INITIATORS = [
  { employee_no: '30001806', initiator_name: 'Muhammad Yasir Khurshid',    dept_incharge_emp_no: '10009578', dept_incharge_name: 'Faisal Amjad',             bu_head_emp_no: '10009572', bu_head_name: 'Faisal Haneef',               department: 'PB' },
  { employee_no: '30001537', initiator_name: 'Adnan Sarwar',                dept_incharge_emp_no: '10009631', dept_incharge_name: 'sarosh sohail',            bu_head_emp_no: '10009572', bu_head_name: 'Faisal Haneef',               department: 'PB' },
  { employee_no: '30000364', initiator_name: 'Muhammad Tariq',              dept_incharge_emp_no: '30000824', dept_incharge_name: 'Arslan Shahid',            bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001935', initiator_name: 'Hammas Saleem',               dept_incharge_emp_no: '30000824', dept_incharge_name: 'Arslan Shahid',            bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001188', initiator_name: 'Syed Kashif Ali Shah',        dept_incharge_emp_no: '30000831', dept_incharge_name: 'Muhammad Maaz Umlash',     bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001503', initiator_name: 'Muhammad Ali',                dept_incharge_emp_no: '10009631', dept_incharge_name: 'sarosh sohail',            bu_head_emp_no: '10009572', bu_head_name: 'Faisal Haneef',               department: 'PB' },
  { employee_no: '30001513', initiator_name: 'Saqib Amin',                  dept_incharge_emp_no: '10009631', dept_incharge_name: 'sarosh sohail',            bu_head_emp_no: '10009572', bu_head_name: 'Faisal Haneef',               department: 'PB' },
  { employee_no: '30001776', initiator_name: 'Nabeel Shahid',               dept_incharge_emp_no: '10009631', dept_incharge_name: 'sarosh sohail',            bu_head_emp_no: '10009572', bu_head_name: 'Faisal Haneef',               department: 'PB' },
  { employee_no: '30000501', initiator_name: 'Muhammad Zubair Sabir',       dept_incharge_emp_no: '30001371', dept_incharge_name: 'Ahsan Anwar',              bu_head_emp_no: '10009732', bu_head_name: 'Farhan Amin',                 department: 'PB' },
  { employee_no: '30000863', initiator_name: 'Noor Zaman',                  dept_incharge_emp_no: '30000864', dept_incharge_name: 'Muhammad Nadeem Raza',     bu_head_emp_no: '10009732', bu_head_name: 'Farhan Amin',                 department: 'CD' },
  { employee_no: '30001637', initiator_name: 'Saad Shoaib Nangiana',        dept_incharge_emp_no: '30001965', dept_incharge_name: 'Salik Masood Khan',        bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001975', initiator_name: 'Muhammad Jahangeer',          dept_incharge_emp_no: '30001965', dept_incharge_name: 'Salik Masood Khan',        bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001994', initiator_name: 'Humail Bhadki',               dept_incharge_emp_no: '30001965', dept_incharge_name: 'Salik Masood Khan',        bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30002003', initiator_name: 'Muhammad Asim',               dept_incharge_emp_no: '30001965', dept_incharge_name: 'Salik Masood Khan',        bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000221', initiator_name: 'Muhammad Ramzan',             dept_incharge_emp_no: '30000972', dept_incharge_name: 'zain asif',                bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001961', initiator_name: 'Salar Fawzi Khawaja',         dept_incharge_emp_no: '30001965', dept_incharge_name: 'Salik Masood Khan',        bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000909', initiator_name: 'Muhammad Akram Tahir',        dept_incharge_emp_no: '30001242', dept_incharge_name: 'Asif Ali',                 bu_head_emp_no: '10009727', bu_head_name: 'Muneef Abid',                 department: 'PB' },
  { employee_no: '30001054', initiator_name: 'Naveed Ahmad',                dept_incharge_emp_no: '30001242', dept_incharge_name: 'Asif Ali',                 bu_head_emp_no: '10009727', bu_head_name: 'Muneef Abid',                 department: 'PB' },
  { employee_no: '30000862', initiator_name: 'Muhammad Rashid Naeem',       dept_incharge_emp_no: '10007934', dept_incharge_name: 'Waqas Ilyas',              bu_head_emp_no: '10009727', bu_head_name: 'Muneef Abid',                 department: 'PB' },
  { employee_no: '30001694', initiator_name: 'Muhammad Omar Shafique',      dept_incharge_emp_no: '10007934', dept_incharge_name: 'Waqas Ilyas',              bu_head_emp_no: '10009727', bu_head_name: 'Muneef Abid',                 department: 'PB' },
  { employee_no: '30000359', initiator_name: 'Asif Waseem',                 dept_incharge_emp_no: '30001242', dept_incharge_name: 'Asif Ali',                 bu_head_emp_no: '10009727', bu_head_name: 'Muneef Abid',                 department: 'PB' },
  { employee_no: '30000407', initiator_name: 'Muhammad Amjad',              dept_incharge_emp_no: '30000098', dept_incharge_name: 'Khushi Mohammad',          bu_head_emp_no: '10009732', bu_head_name: 'Farhan Amin',                 department: 'PB' },
  { employee_no: '30001032', initiator_name: 'Jabran Pasha',                dept_incharge_emp_no: '10009381', dept_incharge_name: 'Afia Khurshid',            bu_head_emp_no: '10009732', bu_head_name: 'Farhan Amin',                 department: 'PB' },
  { employee_no: '30001417', initiator_name: 'Imran Khan',                  dept_incharge_emp_no: '30000024', dept_incharge_name: 'Uffan Sharif',             bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001798', initiator_name: 'Amad Akram',                  dept_incharge_emp_no: '30000024', dept_incharge_name: 'Uffan Sharif',             bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001555', initiator_name: 'Ahmad Afzal',                 dept_incharge_emp_no: '30001997', dept_incharge_name: 'Mahnoor Khan',             bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001982', initiator_name: 'Salman Mansha',               dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000628', initiator_name: 'Ameer Hassan',                dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001836', initiator_name: 'Muhammad Maroof Hussain',     dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000313', initiator_name: 'Fakhar Uz Zaman',             dept_incharge_emp_no: '30000824', dept_incharge_name: 'Arslan Shahid',            bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001628', initiator_name: 'Waqas Ahmad',                 dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000780', initiator_name: 'Syed Muhammad Taqi',          dept_incharge_emp_no: '30001725', dept_incharge_name: 'Syed Sarosh Tariq',        bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000855', initiator_name: 'Ubaid Ullah',                 dept_incharge_emp_no: '30001593', dept_incharge_name: 'Mathew Abneer',            bu_head_emp_no: '30001813', bu_head_name: 'Bilal Naeem',                 department: 'PB' },
  { employee_no: '30000194', initiator_name: 'Muhammad Sabir',              dept_incharge_emp_no: '30000831', dept_incharge_name: 'Muhammad Maaz Umlash',     bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000219', initiator_name: 'Arshad Mahmood',              dept_incharge_emp_no: '30000831', dept_incharge_name: 'Muhammad Maaz Umlash',     bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000378', initiator_name: 'Shahbaz Ahmad',               dept_incharge_emp_no: '30000831', dept_incharge_name: 'Muhammad Maaz Umlash',     bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000404', initiator_name: 'Ayaz Bashir',                 dept_incharge_emp_no: '30000831', dept_incharge_name: 'Muhammad Maaz Umlash',     bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000720', initiator_name: 'Ramiz Basharat',              dept_incharge_emp_no: '30001593', dept_incharge_name: 'Mathew Abneer',            bu_head_emp_no: '30001813', bu_head_name: 'Bilal Naeem',                 department: 'PB' },
  { employee_no: '30000883', initiator_name: 'Tahir Ahmad',                 dept_incharge_emp_no: '30001593', dept_incharge_name: 'Mathew Abneer',            bu_head_emp_no: '30001813', bu_head_name: 'Bilal Naeem',                 department: 'PB' },
  { employee_no: '30001593', initiator_name: 'Matthew Abneer Chand',        dept_incharge_emp_no: '30001593', dept_incharge_name: 'Mathew Abneer',            bu_head_emp_no: '30001813', bu_head_name: 'Bilal Naeem',                 department: 'PB' },
  { employee_no: '30001634', initiator_name: 'Asma Nawaz',                  dept_incharge_emp_no: '30001593', dept_incharge_name: 'Mathew Abneer',            bu_head_emp_no: '30001813', bu_head_name: 'Bilal Naeem',                 department: 'PB' },
  { employee_no: '30000040', initiator_name: 'Qaisar Iqbal',                dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001705', initiator_name: 'Hassnain .',                  dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000438', initiator_name: 'Ghulam Shabir',               dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000617', initiator_name: 'Muhammad Imran',              dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001476', initiator_name: 'Rabia Sadaf',                 dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001723', initiator_name: 'Aqeel Ahmed',                 dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001736', initiator_name: 'Syed Ahmad Ali Shah',         dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000321', initiator_name: 'Zahid Mushtaq',               dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000361', initiator_name: 'Muhammad Asghar',             dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000035', initiator_name: 'Muhammad Amin',               dept_incharge_emp_no: '30000021', dept_incharge_name: 'Muhammad Nauman Zafar',    bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000095', initiator_name: 'Syed Wajid Ali Bukhari',      dept_incharge_emp_no: '30000021', dept_incharge_name: 'Muhammad Nauman Zafar',    bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000595', initiator_name: 'Shazam Toqeer',               dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',     bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000021', initiator_name: 'Muhammad Nauman Zafar',       dept_incharge_emp_no: '30000021', dept_incharge_name: 'Muhammad Nauman Zafar',    bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000582', initiator_name: 'Hafiz Naseer Ahmad',          dept_incharge_emp_no: '30000021', dept_incharge_name: 'Muhammad Nauman Zafar',    bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000872', initiator_name: 'Muhammad Yassar Javeed',      dept_incharge_emp_no: '30000021', dept_incharge_name: 'Muhammad Nauman Zafar',    bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001714', initiator_name: 'Muhammad Hamza Zulfiqar',     dept_incharge_emp_no: '30000021', dept_incharge_name: 'Muhammad Nauman Zafar',    bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001998', initiator_name: 'Muhammad Shahid Ullah Butt',  dept_incharge_emp_no: '30000021', dept_incharge_name: 'Muhammad Nauman Zafar',    bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000771', initiator_name: 'Muhammad Hussaan',            dept_incharge_emp_no: '30000858', dept_incharge_name: 'Emad Ud Din Ahmed',        bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000547', initiator_name: 'Sharjil Naushad',             dept_incharge_emp_no: '30000024', dept_incharge_name: 'Uffan Sharif',             bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000055', initiator_name: 'Muhammad Akram Jawaid',       dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',           bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
];

const config = db.loadAdminConfig();

// Replace initiators for PB and CD entirely with the new complete dataset
config.companies.PB.initiators = [];
config.companies.CD.initiators = [];

for (const row of NEW_INITIATORS) {
  const company = config.companies[row.department];
  if (!company) {
    console.warn(`Unknown company key: ${row.department} for ${row.initiator_name}`);
    continue;
  }
  company.initiators.push({
    empNo: row.employee_no,
    name:  row.initiator_name,
    email: '',
    approvers: {
      dept_incharge: { empNo: row.dept_incharge_emp_no, name: row.dept_incharge_name, email: '' },
      bu_head:       { empNo: row.bu_head_emp_no,       name: row.bu_head_name,       email: '' },
    },
  });
  console.log(`ADD [${row.department}] ${row.employee_no} — ${row.initiator_name}`);
}

db.saveAdminConfig(config);

console.log(`\nDone.`);
console.log(`PB initiators: ${config.companies.PB.initiators.length}`);
console.log(`CD initiators: ${config.companies.CD.initiators.length}`);
