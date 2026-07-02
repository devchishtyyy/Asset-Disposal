'use strict';

const db = require('../db.js');

const NEW_INITIATORS = [
  { employee_no: '30001806', initiator_name: 'Muhammad Yasir Khurshid',   dept_incharge_emp_no: '10009578', dept_incharge_name: 'Faisal Amjad',           bu_head_emp_no: '10009572', bu_head_name: 'Faisal Haneef',               department: 'PB' },
  { employee_no: '30001537', initiator_name: 'Adnan Sarwar',               dept_incharge_emp_no: '10009631', dept_incharge_name: 'sarosh sohail',           bu_head_emp_no: '10009572', bu_head_name: 'Faisal Haneef',               department: 'PB' },
  { employee_no: '30000364', initiator_name: 'Muhammad Tariq',             dept_incharge_emp_no: '30000824', dept_incharge_name: 'Arslan Shahid',           bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001935', initiator_name: 'Hammas Saleem',              dept_incharge_emp_no: '30000824', dept_incharge_name: 'Arslan Shahid',           bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001188', initiator_name: 'Syed Kashif Ali Shah',       dept_incharge_emp_no: '30000831', dept_incharge_name: 'Muhammad Maaz Umlash',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001503', initiator_name: 'Muhammad Ali',               dept_incharge_emp_no: '10009631', dept_incharge_name: 'sarosh sohail',           bu_head_emp_no: '10009572', bu_head_name: 'Faisal Haneef',               department: 'PB' },
  { employee_no: '30001513', initiator_name: 'Saqib Amin',                 dept_incharge_emp_no: '10009631', dept_incharge_name: 'sarosh sohail',           bu_head_emp_no: '10009572', bu_head_name: 'Faisal Haneef',               department: 'PB' },
  { employee_no: '30001540', initiator_name: 'Aamir Mehmood',              dept_incharge_emp_no: '10009631', dept_incharge_name: 'sarosh sohail',           bu_head_emp_no: '10009572', bu_head_name: 'Faisal Haneef',               department: 'PB' },
  { employee_no: '30000305', initiator_name: 'Khurram Shahzad',            dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000455', initiator_name: 'Muhammad Waqas',             dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001602', initiator_name: 'Arslan Ahmed',               dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001716', initiator_name: 'Ahmed Raza',                 dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000303', initiator_name: 'Rashid Mehmood',             dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000325', initiator_name: 'Imran Hussain',              dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000673', initiator_name: 'Ali Raza',                   dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000388', initiator_name: 'Waseem Sajjad',              dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000389', initiator_name: 'Waqas Ahmad',                dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000407', initiator_name: 'Asim Hussain',               dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000424', initiator_name: 'Ali Raza',                   dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001138', initiator_name: 'Nabeel Shaukat',             dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000454', initiator_name: 'Khuram Shahzad',             dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000494', initiator_name: 'Ali Raza Anjum',             dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000508', initiator_name: 'Zubair Ahmad',               dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000570', initiator_name: 'Adeel Anwar',                dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000574', initiator_name: 'Khurram Abbas Shah',         dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001960', initiator_name: 'Wasik Ali Syed',             dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001948', initiator_name: 'Muhammad Naveed',            dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001715', initiator_name: 'Nauman Shaukat',             dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001460', initiator_name: 'Zubair Ahmad',               dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000854', initiator_name: 'Muhammad Husnain',           dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000450', initiator_name: 'Khurram Shahzad',            dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000385', initiator_name: 'Syed Jafar Ali',             dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000331', initiator_name: 'Rana Farhan Arshad',         dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000318', initiator_name: 'Muhammad Umair',             dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000216', initiator_name: 'Malik Zeeshan Ahmad',        dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000049', initiator_name: 'Waseem Sajjad',              dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001944', initiator_name: 'Muhammad Awais',             dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001859', initiator_name: 'Ali Raza',                   dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001804', initiator_name: 'Arslan Ali',                 dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30001736', initiator_name: 'Syed Ahmad Ali Shah',        dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000321', initiator_name: 'Zahid Mushtaq',              dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000361', initiator_name: 'Muhammad Asghar',            dept_incharge_emp_no: '30001960', dept_incharge_name: 'Wasik Ali Syed',          bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000035', initiator_name: 'Muhammad Amin',              dept_incharge_emp_no: '30000021', dept_incharge_name: 'Muhammad Nauman Zafar',   bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000095', initiator_name: 'Syed Wajid Ali Bukhari',     dept_incharge_emp_no: '30000021', dept_incharge_name: 'Muhammad Nauman Zafar',   bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000595', initiator_name: 'Shazam Toqeer',              dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30000021', initiator_name: 'Muhammad Nauman Zafar',      dept_incharge_emp_no: '30000021', dept_incharge_name: 'Muhammad Nauman Zafar',   bu_head_emp_no: '30001966', bu_head_name: 'Aamir Janjua',               department: 'PB' },
  { employee_no: '30000582', initiator_name: 'Hafiz Naseer Ahmad',         dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001407', initiator_name: 'Ali Raza',                   dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001416', initiator_name: 'Muhammad Bilal',             dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001438', initiator_name: 'Ali Shair',                  dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001439', initiator_name: 'Ehsan Elahi',                dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001461', initiator_name: 'Muhammad Ramzan',            dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001490', initiator_name: 'Hafiz Muhammad Ahmad',       dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001491', initiator_name: 'Abid Ali',                   dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001550', initiator_name: 'Zubair Latif',               dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001569', initiator_name: 'Sajid Mahmood',              dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001601', initiator_name: 'Yasir Ali',                  dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001604', initiator_name: 'Mian Muhammad Adeel',        dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001640', initiator_name: 'Naeem Shehzad',              dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001643', initiator_name: 'Muhammad Imran',             dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
  { employee_no: '30001644', initiator_name: 'Tanveer Ahmed',              dept_incharge_emp_no: '30001188', dept_incharge_name: 'Syed Kashif Ali Shah',   bu_head_emp_no: '30000027', bu_head_name: 'Syed Ali Murtaza Bukhari',   department: 'CD' },
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
