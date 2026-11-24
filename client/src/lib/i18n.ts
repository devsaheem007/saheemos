import { create } from 'zustand';

export type Lang = 'en' | 'ur';
const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('saheemos-lang')) as Lang | null;

export function applyDir(l: Lang) {
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ur' ? 'rtl' : 'ltr';
}

export const useLang = create<{ lang: Lang; set: (l: Lang) => void }>((set) => ({
  lang: stored === 'ur' ? 'ur' : 'en',
  set: (l) => { localStorage.setItem('saheemos-lang', l); applyDir(l); set({ lang: l }); },
}));
applyDir(useLang.getState().lang);

// Urdu interface strings. Anything not listed here simply stays in English.
// School data you type (names, announcements, about text) is shown exactly as entered.
const UR: Record<string, string> = {
  // groups & navigation
  'Overview': 'جائزہ', 'People': 'افراد', 'Academics': 'تعلیمی امور', 'Finance': 'مالیات', 'Operations': 'انتظامی امور', 'Communication': 'رابطہ', 'Administration': 'انتظامیہ',
  'Dashboard': 'ڈیش بورڈ', 'My portal': 'میرا پورٹل', 'Students': 'طلبہ', 'Parents': 'والدین', 'Parents & guardians': 'والدین اور سرپرست', 'Teachers': 'اساتذہ', 'Staff': 'عملہ',
  'User accounts': 'صارف اکاؤنٹس', 'Sessions': 'تعلیمی سیشن', 'Academic sessions': 'تعلیمی سیشن', 'Classes': 'جماعتیں', 'Sections': 'سیکشنز', 'Subjects': 'مضامین', 'Timetable': 'ٹائم ٹیبل',
  'Attendance': 'حاضری', 'Exams': 'امتحانات', 'Examinations': 'امتحانات', 'Results': 'نتائج', 'Assignments': 'اسائنمنٹس', 'Submissions': 'جمع شدہ کام',
  'Fee invoices': 'فیس بل', 'Fee structures': 'فیس کا ڈھانچہ', 'Expenses': 'اخراجات', 'Payroll': 'تنخواہیں', 'Library': 'لائبریری', 'Library books': 'لائبریری کی کتب', 'Loans': 'جاری کردہ کتب',
  'Vehicles': 'گاڑیاں', 'Routes': 'روٹس', 'Transport routes': 'ٹرانسپورٹ روٹس', 'Leave': 'رخصت', 'Leave requests': 'رخصت کی درخواستیں', 'Inventory': 'انوینٹری',
  'Announcements': 'اعلانات', 'Inquiries': 'انکوائریاں', 'Admission inquiries': 'داخلہ انکوائریاں', 'Messages': 'پیغامات', 'School settings': 'اسکول کی ترتیبات', 'Audit log': 'آڈٹ لاگ', 'SMS log': 'ایس ایم ایس لاگ',
  'Notifications': 'اطلاعات', 'Profile & password': 'پروفائل اور پاسورڈ', 'Home': 'ہوم', 'Sign out': 'سائن آؤٹ', 'Sign in': 'سائن اِن',
  // common actions & states
  'Save': 'محفوظ کریں', 'Cancel': 'منسوخ کریں', 'Confirm': 'تصدیق کریں', 'Please confirm': 'براہِ کرم تصدیق کریں', 'Add {x}': '{x} شامل کریں', 'Edit': 'ترمیم', 'Delete': 'حذف کریں',
  'Edit {x}': '{x} میں ترمیم', 'Export': 'برآمد کریں', 'Search': 'تلاش', 'Search {x}': '{x} تلاش کریں', 'Previous': 'پچھلا', 'Next': 'اگلا', 'Page {n} of {m}': 'صفحہ {n} از {m}', '{n} records': '{n} ریکارڈ',
  'Actions': 'کارروائیاں', 'Loading…': 'لوڈ ہو رہا ہے…', 'Select…': 'منتخب کریں…', 'This field is required': 'یہ خانہ ضروری ہے', 'Close': 'بند کریں', 'Yes': 'ہاں', 'No': 'نہیں',
  'No matches': 'کوئی نتیجہ نہیں ملا', 'Try a different search.': 'کوئی اور لفظ آزما کر دیکھیں۔', 'No {x} yet': 'ابھی کوئی {x} موجود نہیں', 'Could not load data': 'ڈیٹا لوڈ نہیں ہو سکا',
  'Delete this {x}? This cannot be undone.': 'کیا آپ یہ {x} حذف کرنا چاہتے ہیں؟ یہ عمل واپس نہیں ہو سکتا۔', 'Print / save as PDF': 'پرنٹ / پی ڈی ایف محفوظ کریں', 'Download PDF': 'پی ڈی ایف ڈاؤن لوڈ کریں',
  'You do not have access to this page': 'آپ کو اس صفحے تک رسائی حاصل نہیں', 'Page not found': 'صفحہ نہیں ملا',
  // auth
  'Email': 'ای میل', 'Password': 'پاسورڈ', 'Forgot password?': 'پاسورڈ بھول گئے؟', 'School website': 'اسکول کی ویب سائٹ', 'Use the account created for you by the school office.': 'اسکول آفس کی طرف سے بنایا گیا اکاؤنٹ استعمال کریں۔',
  'Reset your password': 'پاسورڈ دوبارہ ترتیب دیں', 'Send reset link': 'ری سیٹ لنک بھیجیں', 'Back to sign in': 'سائن اِن پر واپس جائیں', 'Choose a new password': 'نیا پاسورڈ منتخب کریں', 'Update password': 'پاسورڈ اپڈیٹ کریں',
  'The Operating System for Education.': 'تعلیم کا آپریٹنگ سسٹم۔',
  // dashboard
  "Live figures from your school's records": 'آپ کے اسکول کے ریکارڈ سے براہِ راست اعداد و شمار', "Today's attendance": 'آج کی حاضری', 'Pending fees': 'واجب الادا فیس', 'Revenue this month': 'اس ماہ کی آمدنی',
  'Low-stock items': 'کم اسٹاک اشیاء', 'Recent admissions': 'حالیہ داخلے', 'Upcoming examinations': 'آنے والے امتحانات', 'Events & pinned notices': 'تقریبات اور اہم نوٹس', 'Recent activity': 'حالیہ سرگرمی',
  'Fee collection, last 6 months': 'فیس کی وصولی، پچھلے 6 ماہ', 'Student attendance, last 7 days': 'طلبہ کی حاضری، پچھلے 7 دن', 'Not marked': 'نشان زد نہیں',
  // attendance
  'Mark all present': 'سب کو حاضر لگائیں', 'Save attendance': 'حاضری محفوظ کریں', 'Monthly summary': 'ماہانہ خلاصہ', 'Choose class…': 'جماعت منتخب کریں…', 'Present': 'حاضر', 'Absent': 'غیر حاضر', 'Late': 'تاخیر', 'Excel': 'ایکسل',
  // messages
  'Inbox': 'ان باکس', 'Sent': 'بھیجے گئے', 'New message': 'نیا پیغام', 'To': 'وصول کنندہ', 'Send': 'بھیجیں', 'Reply': 'جواب دیں', 'Write your message…': 'اپنا پیغام لکھیں…',
  'Messages between you and school staff': 'آپ اور اسکول کے عملے کے درمیان پیغامات', 'Search people by name': 'نام سے تلاش کریں', 'No messages yet': 'ابھی کوئی پیغام نہیں',
  // public site
  'About': 'ہمارے بارے میں', 'About the school': 'اسکول کے بارے میں', 'Academic programs': 'تعلیمی پروگرام', 'Admissions': 'داخلہ', 'News & events': 'خبریں اور تقریبات', 'Contact': 'رابطہ', 'Contact us': 'ہم سے رابطہ کریں',
  'Portal sign-in': 'پورٹل میں داخلہ', 'Apply for admission': 'داخلے کے لیے درخواست دیں', 'Learn more': 'مزید جانیں', 'Admission inquiry': 'داخلہ انکوائری', 'Send inquiry': 'انکوائری بھیجیں',
  'Parent / guardian name *': 'والدین / سرپرست کا نام *', 'Phone *': 'فون *', 'Class applying for': 'جس جماعت میں داخلہ درکار ہے', 'Message': 'پیغام', 'Upcoming events': 'آنے والی تقریبات', 'Facilities': 'سہولیات',
  // table columns & form fields
  'Admission no.': 'داخلہ نمبر', 'Name': 'نام', 'Class': 'جماعت', 'Section': 'سیکشن', 'Guardian': 'سرپرست', 'Guardian phone': 'سرپرست کا فون', 'Status': 'حالت', 'ID': 'آئی ڈی', 'Department': 'شعبہ',
  'Designation': 'عہدہ', 'Phone': 'فون', 'Amount': 'رقم', 'Date': 'تاریخ', 'Title': 'عنوان', 'Category': 'زمرہ', 'Type': 'قسم', 'Subject': 'مضمون', 'Message subject': 'موضوع', 'Print': 'پرنٹ کریں', 'Teacher': 'استاد',  'Starts': 'آغاز', 'Ends': 'اختتام', 'Due': 'آخری تاریخ',
  'Total': 'کل', 'Paid': 'ادا شدہ', 'Balance': 'بقایا', 'Invoice': 'بل', 'Student': 'طالب علم', 'For': 'برائے', 'Employee': 'ملازم', 'Month': 'مہینہ', 'Basic': 'بنیادی', 'Net pay': 'خالص تنخواہ', 'Marks': 'نمبر',
  'First name': 'پہلا نام', 'Last name': 'آخری نام', 'Gender': 'جنس', 'Date of birth': 'تاریخ پیدائش', 'Address': 'پتہ', 'Photograph': 'تصویر', 'Guardian name': 'سرپرست کا نام', 'Relation': 'رشتہ',
  'Guardian email': 'سرپرست کا ای میل', 'Class (optional)': 'جماعت (اختیاری)', 'Fee name': 'فیس کا نام', 'Due date': 'آخری تاریخ', 'Notes': 'نوٹس',
  'Parent': 'والد / سرپرست', 'Staff member': 'عملے کا رکن', 'Session': 'سیشن', 'Period': 'پیریڈ', 'Fee': 'فیس', 'Expense': 'خرچ', 'Exam': 'امتحان', 'Assignment': 'اسائنمنٹ', 'Submission': 'جمع شدہ کام',
  'Announcement': 'اعلان', 'Book': 'کتاب', 'Loan': 'جاری کردہ کتاب', 'Vehicle': 'گاڑی', 'Route': 'روٹ', 'Leave request': 'رخصت کی درخواست', 'Item': 'چیز', 'Inquiry': 'انکوائری', 'Entry': 'اندراج', 'User': 'صارف',
  // statuses
  'active': 'فعال', 'inactive': 'غیر فعال', 'transferred': 'منتقل شدہ', 'graduated': 'فارغ التحصیل', 'paid': 'ادا شدہ', 'unpaid': 'غیر ادا شدہ', 'partial': 'جزوی', 'pending': 'زیر التوا',
  'approved': 'منظور شدہ', 'rejected': 'مسترد', 'draft': 'مسودہ', 'published': 'شائع شدہ', 'new': 'نیا', 'contacted': 'رابطہ کیا گیا', 'admitted': 'داخل', 'closed': 'بند', 'present': 'حاضر', 'absent': 'غیر حاضر',
  'late': 'تاخیر', 'leave': 'رخصت', 'male': 'مرد', 'female': 'عورت', 'other': 'دیگر', 'monthly': 'ماہانہ', 'cash': 'نقد', 'bank': 'بینک', 'cheque': 'چیک', 'notice': 'نوٹس', 'event': 'تقریب', 'news': 'خبر',
  // finance, settings, sms
  'Generate invoices': 'بل تیار کریں', 'Remind overdue': 'تاخیر کی یاد دہانی', 'Pay': 'ادائیگی', 'Receipts': 'رسیدیں', 'Receipt': 'رسید', 'Record payment': 'ادائیگی درج کریں', 'Generate payroll': 'تنخواہیں تیار کریں',
  'Approve': 'منظور کریں', 'Mark paid': 'ادا شدہ نشان زد کریں', 'Payslip': 'تنخواہ کی پرچی', 'Edit settings': 'ترتیبات میں ترمیم', 'Send test SMS': 'ٹیسٹ ایس ایم ایس بھیجیں', 'Report card': 'رپورٹ کارڈ',
  'Enter marks': 'نمبر درج کریں', 'Class results': 'جماعت کے نتائج', 'Save marks': 'نمبر محفوظ کریں', 'Publish results': 'نتائج شائع کریں', 'Unpublish results': 'نتائج کی اشاعت روکیں',
  'Mark all read': 'سب پڑھے ہوئے نشان زد کریں', 'Mark read': 'پڑھا ہوا', 'Language': 'زبان', 'Manage': 'انتظام', 'Create user account': 'صارف اکاؤنٹ بنائیں',
};

export function t(s: string, vars?: Record<string, string | number>): string {
  const ur = useLang.getState().lang === 'ur';
  let out = (ur && (UR[s] ?? UR[s.toLowerCase()])) || s;
  if (vars) for (const k of Object.keys(vars)) out = out.replace(`{${k}}`, String(vars[k]));
  return out;
}
export const isRtl = () => useLang.getState().lang === 'ur';
