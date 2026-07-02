'use strict';

const db = require('../db.js');

const NEW_INITIATORS = [
  { initiator: 'Muhammad Yasir Khurshid',   department: 'PB', dept_incharge: 'Faisal Amjad',           bu_head: 'Faisal Haneef' },
  { initiator: 'Adnan Sarwar',               department: 'PB', dept_incharge: 'sarosh sohail',           bu_head: 'Faisal Haneef' },
  { initiator: 'Muhammad Tariq',             department: 'CD', dept_incharge: 'Arslan Shahid',           bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Hammas Saleem',              department: 'CD', dept_incharge: 'Arslan Shahid',           bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Syed Kashif Ali Shah',       department: 'CD', dept_incharge: 'Muhammad Maaz Umlash',   bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Muhammad Ali',               department: 'PB', dept_incharge: 'sarosh sohail',           bu_head: 'Faisal Haneef' },
  { initiator: 'Saqib Amin',                 department: 'PB', dept_incharge: 'sarosh sohail',           bu_head: 'Faisal Haneef' },
  { initiator: 'Nabeel Shahid',              department: 'PB', dept_incharge: 'sarosh sohail',           bu_head: 'Faisal Haneef' },
  { initiator: 'Muhammad Zubair Sabir',      department: 'PB', dept_incharge: 'Ahsan Anwar',             bu_head: 'Farhan Amin' },
  { initiator: 'Noor Zaman',                 department: 'CD', dept_incharge: 'Muhammad Nadeem Raza',    bu_head: 'Farhan Amin' },
  { initiator: 'Saad Shoaib Nangiana',       department: 'CD', dept_incharge: 'Salik Masood Khan',       bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Muhammad Jahangeer',         department: 'CD', dept_incharge: 'Salik Masood Khan',       bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Humail Bhadki',              department: 'CD', dept_incharge: 'Salik Masood Khan',       bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Muhammad Asim',              department: 'CD', dept_incharge: 'Salik Masood Khan',       bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Muhammad Ramzan',            department: 'CD', dept_incharge: 'zain asif',               bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Salar Fawzi Khawaja',        department: 'CD', dept_incharge: 'Salik Masood Khan',       bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Muhammad Akram Tahir',       department: 'PB', dept_incharge: 'Asif Ali',                bu_head: 'Muneef Abid' },
  { initiator: 'Naveed Ahmad',               department: 'PB', dept_incharge: 'Asif Ali',                bu_head: 'Muneef Abid' },
  { initiator: 'Muhammad Rashid Naeem',      department: 'PB', dept_incharge: 'Waqas Ilyas',             bu_head: 'Muneef Abid' },
  { initiator: 'Muhammad Omar Shafique',     department: 'PB', dept_incharge: 'Waqas Ilyas',             bu_head: 'Muneef Abid' },
  { initiator: 'Asif Waseem',                department: 'PB', dept_incharge: 'Asif Ali',                bu_head: 'Muneef Abid' },
  { initiator: 'Muhammad Amjad',             department: 'PB', dept_incharge: 'Khushi Mohammad',         bu_head: 'Farhan Amin' },
  { initiator: 'Jabran Pasha',               department: 'PB', dept_incharge: 'Afia Khurshid',           bu_head: 'Farhan Amin' },
  { initiator: 'Imran Khan',                 department: 'PB', dept_incharge: 'Uffan Sharif',            bu_head: 'Aamir Janjua' },
  { initiator: 'Amad Akram',                 department: 'PB', dept_incharge: 'Uffan Sharif',            bu_head: 'Aamir Janjua' },
  { initiator: 'Ahmad Afzal',                department: 'CD', dept_incharge: 'Mahnoor Khan',            bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Salman Mansha',              department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Ameer Hassan',               department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Muhammad Maroof Hussain',    department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Fakhar Uz Zaman',            department: 'CD', dept_incharge: 'Arslan Shahid',           bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Waqas Ahmad',                department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Syed Muhammad Taqi',         department: 'PB', dept_incharge: 'Syed Sarosh Tariq',       bu_head: 'Aamir Janjua' },
  { initiator: 'Ubaid Ullah',                department: 'PB', dept_incharge: 'Financial Controller',    bu_head: 'Bilal Naeem' },
  { initiator: 'Muhammad Sabir',             department: 'CD', dept_incharge: 'Muhammad Maaz Umlash',   bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Arshad Mahmood',             department: 'CD', dept_incharge: 'Muhammad Maaz Umlash',   bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Shahbaz Ahmad',              department: 'CD', dept_incharge: 'Muhammad Maaz Umlash',   bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Ayaz Bashir',                department: 'CD', dept_incharge: 'Muhammad Maaz Umlash',   bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Ramiz Basharat',             department: 'PB', dept_incharge: 'Financial Controller',    bu_head: 'Bilal Naeem' },
  { initiator: 'Tahir Ahmad',                department: 'PB', dept_incharge: 'Financial Controller',    bu_head: 'Bilal Naeem' },
  { initiator: 'Matthew Abneer Chand',       department: 'PB', dept_incharge: 'Financial Controller',    bu_head: 'Bilal Naeem' },
  { initiator: 'Asma Nawaz',                 department: 'PB', dept_incharge: 'Financial Controller',    bu_head: 'Bilal Naeem' },
  { initiator: 'Qaisar Iqbal',               department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Hassnain .',                 department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Ghulam Shabir',              department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Muhammad Imran',             department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Rabia Sadaf',                department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Aqeel Ahmed',                department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Syed Ahmad Ali Shah',        department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Zahid Mushtaq',              department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Muhammad Asghar',            department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
  { initiator: 'Muhammad Amin',              department: 'PB', dept_incharge: 'Muhammad Nauman Zafar',   bu_head: 'Aamir Janjua' },
  { initiator: 'Syed Wajid Ali Bukhari',     department: 'PB', dept_incharge: 'Muhammad Nauman Zafar',   bu_head: 'Aamir Janjua' },
  { initiator: 'Shazam Toqeer',              department: 'CD', dept_incharge: 'Syed Kashif Ali Shah',    bu_head: 'Syed Ali Murtaza Bukhari' },
  { initiator: 'Muhammad Nauman Zafar',      department: 'PB', dept_incharge: 'Muhammad Nauman Zafar',   bu_head: 'Aamir Janjua' },
  { initiator: 'Hafiz Naseer Ahmad',         department: 'PB', dept_incharge: 'Muhammad Nauman Zafar',   bu_head: 'Aamir Janjua' },
  { initiator: 'Muhammad Yassar Javeed',     department: 'PB', dept_incharge: 'Muhammad Nauman Zafar',   bu_head: 'Aamir Janjua' },
  { initiator: 'Muhammad Hamza Zulfiqar',    department: 'PB', dept_incharge: 'Muhammad Nauman Zafar',   bu_head: 'Aamir Janjua' },
  { initiator: 'Muhammad Shahid Ullah Butt', department: 'PB', dept_incharge: 'Muhammad Nauman Zafar',   bu_head: 'Aamir Janjua' },
  { initiator: 'Muhammad Hussaan',           department: 'PB', dept_incharge: 'Emad Ud Din Ahmed',       bu_head: 'Aamir Janjua' },
  { initiator: 'Sharjil Naushad',            department: 'PB', dept_incharge: 'Uffan Sharif',            bu_head: 'Aamir Janjua' },
  { initiator: 'Muhammad Akram Jawaid',      department: 'PB', dept_incharge: 'Wasik Ali Syed',          bu_head: 'Aamir Janjua' },
];

function makeInitiatorEntry(row) {
  return {
    empNo: '',
    name:  row.initiator,
    email: '',
    approvers: {
      dept_incharge: { empNo: '', name: row.dept_incharge, email: '' },
      bu_head:       { empNo: '', name: row.bu_head,       email: '' },
    },
  };
}

const config = db.loadAdminConfig();

let addedPB = 0;
let addedCD = 0;

for (const row of NEW_INITIATORS) {
  const companyKey = row.department; // already 'PB' or 'CD'
  const company    = config.companies[companyKey];
  if (!company) {
    console.warn(`Unknown company key: ${companyKey} for ${row.initiator}`);
    continue;
  }

  const alreadyExists = company.initiators.some(
    (i) => i.name.trim().toLowerCase() === row.initiator.trim().toLowerCase()
  );
  if (alreadyExists) {
    console.log(`SKIP (exists): ${row.initiator} [${companyKey}]`);
    continue;
  }

  company.initiators.push(makeInitiatorEntry(row));
  if (companyKey === 'PB') addedPB++;
  else addedCD++;
  console.log(`ADD: ${row.initiator} [${companyKey}]`);
}

db.saveAdminConfig(config);

console.log(`\nDone. Added ${addedPB} to PB, ${addedCD} to CD.`);
console.log(`PB total initiators: ${config.companies.PB.initiators.length}`);
console.log(`CD total initiators: ${config.companies.CD.initiators.length}`);
console.log('\nNOTE: empNo is blank for all new entries. Fill them in via the Admin Panel so initiators can log in.');
