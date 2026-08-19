// ตัวเลือก dropdown สำหรับหน้ารายละเอียดเคส

export const PROVINCE_OPTIONS = [
  '-- ระบุ --', 'กระบี่', 'กรุงเทพ ฯ', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร',
  'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร',
  'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม',
  'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน',
  'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี', 'ปัตตานี', 'พะเยา',
  'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่',
  'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด',
  'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ',
  'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร',
  'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี',
  'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'พระนครศรีอยุธยา', 'อ่างทอง',
  'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี', 'เบตง',
  'บึงกาฬ', 'อื่นๆ',
];

// ยี่ห้อรถ — sync EMCS master ddlCMFG แยกตาม 'ประเภทรถ' (ddlCType) 2026-07-25
// EMCS กรองลิสต์ยี่ห้อตามประเภทรถ: 350 ยี่ห้อไม่ซ้ำ แต่ 231 ตัวมีอยู่แค่ประเภทเดียว
export const CAR_BRANDS_BY_TYPE: Record<string, string[]> = {
  // เก๋งเอเชีย
  A: [
    'AION', 'ASIACAB', 'ATTHAM', 'AVATR', 'BAOJUN', 'BORGWARD', 'BYD', 'CHANGAN',
    'CHERY', 'DAEWOO', 'DAIHATSU', 'DATSUN', 'DFM', 'FOMM', 'FORD', 'GEELY', 'HAVAL',
    'HINDUSTAN', 'HONDA', 'HONGQI', 'HUASONG', 'HYUNDAI', 'ISUZU', 'JAECOO', 'JETOUR', 'JONWAY',
    'JUNEYAO', 'KIA', 'LEAPMOTOR', 'LEPAS', 'LEXUS', 'LI AUTO', 'LUXGEN', 'LYNK CO', 'MAHINDRA',
    'MAZDA', 'MG', 'MITSUBISHI', 'MITSUOKA', 'NASA', 'NAZA', 'NETA', 'NIO', 'NISSAN', 'OMODA',
    'ORA', 'PERODUA', 'POCCO', 'PORSCHE', 'PROTON', 'SKODA', 'SSANGYONG', 'SUBARU', 'SUZUKI',
    'TANK', 'TATA', 'TOYOTA', 'TRUMPCHI', 'VIAUTO', 'VINFAST', 'VMC', 'VOLT', 'WEIAO BOMA',
    'WELTMEISTER', 'WEY', 'WULING', 'XPENG', 'ZEEKR', 'ZOTYE',
  ],
  // เก๋งยุโรป
  E: [
    'ALFA', 'ALLARD', 'ALPINE', 'AMC JAVELIN', 'ASTONMARTIN', 'AUDI', 'AUSTIN',
    'BENTLEY', 'BENZ', 'BMW', 'BYD', 'CADILLAC', 'CHEVROLET', 'CHRYSLER', 'CITROEN', 'DAIMLER',
    'DODGE', 'EM', 'FERRARI', 'FIAT', 'FORD', 'HILLMAN', 'HOLDEN', 'HUMMER', 'JAGUAR', 'JEEP',
    'LAMBORGHINI', 'LANCIA', 'LANDROVER', 'LEXUS', 'LINCOLN', 'LONDON', 'LOTUS', 'MASERATI',
    'MAZDA', 'MCLAREN', 'MERCER', 'MG', 'MINI', 'MORRIS', 'OLDSMOBILE', 'OPEL', 'PEUGEOT',
    'PONTIAC', 'PORSCHE', 'RENAULT', 'ROEWE', 'ROLLSROYCE', 'ROVER', 'SAAB', 'SEAT', 'SIMCA',
    'SKODA', 'SMART', 'SUZUKI', 'TATRA', 'TESLA', 'TOYOTA', 'VOLKSWAGEN', 'VOLVO',
  ],
  // รถจักรยานยนต์
  M: [
    'AJ', 'ALPHA VOLANTIS', 'APRILIA', 'ATV', 'BAJAJ', 'BENELLI', 'BICOSE', 'BMW',
    'CAGIVA', 'CAN-AM', 'CFMOTO', 'DECO', 'DUCATI', 'EM', 'ENGY', 'ETRAN', 'EVO', 'GPX',
    'HANWAY', 'HAONAIQI', 'HARDE', 'HARLEY', 'HARLEYDEVIDSON', 'HONDA', 'HSEM', 'HUNTER',
    'HUSABER', 'I-MOTOR', 'ISUZU', 'JONWAY', 'JRD', 'KAVALLO', 'KAWASAKI', 'KEEWAY', 'KOZAWA',
    'KTM', 'L&P', 'LAMBRETTA', 'LIFAN', 'LION', 'LONCIN', 'LUCKY', 'LUYUAN', 'MALAGUTI', 'MJNT',
    'MODENAS', 'MODYAK', 'MOTO GUZZI', 'MOTO PARILLA', 'MZ', 'NISSAN', 'NIU', 'NKT', 'PATTINUM',
    'PEDA', 'PEUGEOT', 'PIAGGIO', 'PLATINUM', 'RAPID', 'ROYAL ALLOY', 'ROYAL ENFIELD', 'RYUKA',
    'SACHS', 'SCOMADI', 'SHINERAY', 'SLEEK', 'STALLIONS', 'STAR8', 'STROM', 'SUZUKI',
    'SWAP AND GO', 'SWM', 'SYM', 'TIGER', 'TOMAS', 'TRIUMPH', 'VARETA', 'VESPA', 'VINFAST',
    'VMOTO', 'YADEA', 'YAMAHA', 'ZONGSHEN', 'ZONTES',
  ],
  // รถอื่นๆ
  O: [
    'AICHI', 'ANKAI', 'APRILIA', 'ASHOK LEYLAND', 'ASIASTAR', 'ATV', 'BAOJUN', 'BENELLI',
    'BENZ', 'BIZNEX', 'BMC', 'BMW', 'BOBCAT', 'BOMAG', 'BONLUCK', 'BYD', 'CAMC', 'CATERPILLAR',
    'CFMOTO', 'CHANGLIN', 'CHEETAH', 'CHERY', 'CIAGIA', 'CLAAS', 'DAEWOO', 'DAF', 'DAIHATSU',
    'DAYUN', 'DENWAY', 'DEVA', 'DFM', 'DONGFENG', 'DUCATI', 'EAGLE', 'EUROTRAC', 'EVT', 'FAW',
    'FORD', 'FOTON', 'FURUKAWA', 'GALION', 'GENIE', 'GOLDENDRAGON', 'GOLDHOFER', 'GPX', 'GTM',
    'HALLA', 'HANIX', 'HAONAIQI', 'HARLEYDEVIDSON', 'HENGTONG', 'HIDROMEK', 'HIGER', 'HINO',
    'HINOTA', 'HITACHI', 'HONDA', 'HUAJIAN', 'HUMMER', 'HUNTER', 'HYDROQUIP', 'HYMER', 'HYSTER',
    'HYUNDAI', 'IHI', 'IMIO', 'INGERSOLLRAND', 'INTERNATIONAL', 'ISKI', 'ISUZU', 'IVECO', 'JAC',
    'JCB', 'JGM', 'JIAHE', 'JMC', 'JNT', 'JOHNSTON', 'JRD', 'KALMAR', 'KATO', 'KAVALLO',
    'KAWASAKI', 'KIA', 'KINGLONG', 'KOBELCO', 'KOMATSU', 'KRUPP', 'KTM', 'KUBOTA', 'LEYLAND',
    'LIBAMOTOR', 'LIEBHERR', 'LIFAN', 'LIUGONG', 'LONKING', 'LOVOL', 'LV', 'MACK', 'MAN',
    'MARSHELL', 'MASSEY FERGUSON', 'MAX LOGGER', 'MAZDA', 'MEADOW', 'MG', 'MIDEA', 'MINE',
    'MINI', 'MITSUBISHI', 'MODYAK', 'MONIKA', 'NAGANO', 'NEX', 'NICHIYU', 'NIIGATA', 'NISSAN',
    'OMNIA', 'ORA', 'P&H', 'PANUS', 'PETERBILT', 'PIAGGIO', 'PLATINUM', 'RCK', 'ROADTEC',
    'ROSENBAUER', 'ROYAL ALLOY', 'ROYAL ENFIELD', 'SAKUN.C', 'SAMMITR', 'SANY', 'SCANIA',
    'SDLG', 'SHACMAN', 'SHANTUI', 'SINGTHAI', 'SINOMACH', 'SINOTRUK', 'SKYWELL', 'SOKON',
    'STALLIONS', 'STEYR', 'SUMITOMO', 'SUNLONG', 'SUNWARD', 'SUZUKI', 'SYZG', 'TADANO',
    'TALAYTHONG', 'TATA', 'TCM', 'TEREX', 'TESLA', 'THAINA', 'TIGER', 'TKING', 'TOYOTA',
    'TRAILER', 'TRIUMPH', 'VESPA', 'VOLVO', 'WIRTGEN', 'XCMG', 'XGMA', 'XINYUAN', 'YADEA',
    'YAMAHA', 'YANMAR', 'YAXING', 'YBM', 'YUCHAI', 'YUTONG', 'ZHONGTONG', 'ZOOMLION',
  ],
  // กระบะ
  T: [
    'BENZ', 'BYD', 'CHANGAN', 'CHEVROLET', 'CITROEN', 'DAIHATSU', 'DATSUN', 'DFM',
    'DODGE', 'FIREBRIGHT', 'FORD', 'FOTON', 'GMC', 'HONDA', 'HUANGHAI', 'INTERNATIONAL',
    'ISUZU', 'JAC', 'JEEP', 'KARRY', 'KIA', 'KINGLONG', 'MAZDA', 'MG', 'MITSUBISHI', 'NEX',
    'NEXTEM', 'NISSAN', 'OPEL', 'PEUGEOT', 'POER', 'RAM', 'RELY', 'RIDDARA', 'SAMMITR',
    'SKYWELL', 'SUZUKI', 'TAKANO', 'TATA', 'THAIRUNG', 'TOYOTA', 'VOLKSWAGEN', 'WULING',
  ],
  // รถตู้
  V: [
    'AION', 'BENZ', 'BYD', 'CHEVROLET', 'CHRYSLER', 'CITROEN', 'DAIHATSU', 'DATSUN',
    'DENZA', 'DFM', 'FARIZON', 'FORD', 'FOTON', 'GMC', 'HIGER', 'HINO', 'HONDA', 'HYUNDAI',
    'ISUZU', 'JINBEI', 'JOYLONG', 'KARRY', 'KIA', 'KYC', 'LEXUS', 'MAXUS', 'MAZDA', 'MG',
    'MITSUBISHI', 'NISSAN', 'PEUGEOT', 'POLARSUN', 'RELY', 'RENAULT', 'ROEWE', 'SKYWELL',
    'SOKON', 'SUBARU', 'SUZUKI', 'THAIRUNG', 'TOYOTA', 'TRUMPCHI', 'VOLKSWAGEN', 'WEY',
    'WULING', 'XPENG', 'ZEEKR', 'ZHONGTONG',
  ],
  // รถบรรทุก
  W: [
    'BEIBEN', 'BENZ', 'BMC', 'BMW', 'CAMC', 'CHENGLONG', 'DAF', 'DAYUN', 'DEVA', 'DFM',
    'DONGFENG', 'EVO', 'FAW', 'FORD', 'FOTON', 'FUSO', 'HILLMAN', 'HINO', 'HONGYANG', 'HYUNDAI',
    'ISUZU', 'IVECO', 'JAC', 'JMC', 'KIA', 'MAN', 'MAZDA', 'MINE', 'MITSUBISHI', 'NEOMOR',
    'NEX', 'NISSAN', 'REO', 'RILEY', 'SAMMIT', 'SAMMITR', 'SANY', 'SCANIA', 'SERES', 'SHACMAN',
    'SHINERAY', 'SINOTRUK', 'SKYWELL', 'SOKON', 'STEYR', 'TADANO', 'TATA', 'TATRA', 'THAINA',
    'TKING', 'TOYOTA', 'TRAILER', 'UD TRUCKS', 'UDTRUCKS', 'VOLVO', 'WIRTGEN', 'WULING', 'XCMG',
    'YUCHAI', 'YUTONG',
  ],
};

/** ป้ายไทย → code — คู่กรณีเก็บ "ประเภทรถ" เป็นป้ายไทย ('เก๋งเอเชีย') ไม่ใช่ code
 *  ตารางยี่ห้อข้างบน key เป็น code → ถ้าไม่แปลงก่อน ลิสต์ยี่ห้อของคู่กรณีจะว่างเปล่าทุกคัน
 *  (มือถือแปลงทางกลับกันอยู่แล้วที่ carBrandsFor ใน survey_master.dart) */
const CAR_TYPE_LABEL_TO_CODE: Record<string, string> = {
  'เก๋งเอเชีย': 'A', 'เก๋งยุโรป': 'E', 'รถจักรยานยนต์': 'M', 'รถอื่นๆ': 'O',
  'กระบะ': 'T', 'รถตู้': 'V', 'รถบรรทุก': 'W',
};

/** ตัวเลือกยี่ห้อของประเภทรถนี้ — รับได้ทั้ง code (A/E/M/O/T/V/W) และป้ายไทย
 *  current: ค่าที่บันทึกไว้แล้ว ถ้าไม่อยู่ในลิสต์ (ข้อมูลเก่าเป็นไทย เช่น 'เอ็มจี')
 *  ให้คงไว้เป็นตัวเลือก ไม่งั้น select จะเด้งไป '-- ระบุ --' แล้วเซฟทับค่าเดิมทิ้ง */
export function carBrandOptions(carType?: string | null, current?: string | null): string[] {
  const raw = (carType || '').trim();
  const list = CAR_BRANDS_BY_TYPE[CAR_TYPE_LABEL_TO_CODE[raw] ?? raw] ?? [];
  const cur = (current || '').trim();
  const keep = cur && cur !== '-- ระบุ --' && !list.includes(cur) ? [cur] : [];
  return ['-- ระบุ --', ...list, ...keep];
}

// sync EMCS master ddlCar_Color (verbatim 55 สี) 2026-07-25
export const CAR_COLOR_OPTIONS = [
  '-- ระบุ --', 'ขาว', 'เทา', 'เงิน', 'ทอง', 'เหลือง', 'เขียว', 'ฟ้า', 'น้ำเงิน', 'ม่วง',
  'แดง', 'ส้ม', 'เลือดหมู', 'ดำ', 'ขาว / ทอง', 'เทา / เงิน', 'เหลือง / เงิน', 'เขียว / เงิน',
  'น้ำเงิน / เทา', 'น้ำเงิน / เงิน', 'แดง / เทา', 'ดำ / เทา', 'น้ำตาล', 'เขียว / เทา', 'ชมพู',
  'แดง/ทอง', 'เขียว / เหลือง', 'ขาวมุก', 'ขาว / เขียว / เหลือง', 'น้ำตาล / เทา', 'บรอน',
  'เทา/น้ำเงิน/เหลือง', 'ฟ้า/แดง', 'ทอง / น้ำตาล', 'น้ำตาล / เขียว', 'ขาว / น้ำเงิน',
  'บรอนทอง', 'ขาว / น้ำตาล', 'บรอนฟ้า', 'ครีม', 'ขาว / เหลือง / ส้ม', 'ดำ / น้ำตาล',
  'น้ำเงิน / น้ำตาล', 'ขาว / เทา', 'เหลือง/ทอง', 'ม่วง/เทา', 'บรอน/ทอง', 'ขาว/ดำ', 'ขาว/แดง',
  'แดง/ดำ', 'ขาว/ส้ม/เขียว', 'ดำ/ขาว/เหลือง', 'ขาว/แดง/หลายสี', 'หลายสี', 'UNDEFINE',
  'เหลือง/ดำ'
];

export const BANGKOK_DISTRICT_OPTIONS = [
  '-- เขต --', 'เขตพระนคร', 'เขตดุสิต', 'เขตหนองจอก', 'เขตบางรัก', 'เขตบางเขน',
  'เขตบางกะปิ', 'เขตปทุมวัน', 'เขตป้อมปราบศัตรูพ่าย', 'เขตพระโขนง', 'เขตมีนบุรี',
  'เขตลาดกระบัง', 'เขตยานนาวา', 'เขตสัมพันธวงศ์', 'เขตพญาไท', 'เขตธนบุรี',
  'เขตบางกอกใหญ่', 'เขตห้วยขวาง', 'เขตคลองสาน', 'เขตตลิ่งชัน', 'เขตบางกอกน้อย',
  'เขตบางขุนเทียน', 'เขตภาษีเจริญ', 'เขตหนองแขม', 'เขตราษฎร์บูรณะ', 'เขตบางพลัด',
  'เขตดินแดง', 'เขตบึงกุ่ม', 'เขตสาทร', 'เขตบางซื่อ', 'เขตจตุจักร', 'เขตบางคอแหลม',
  'เขตประเวศ', 'เขตคลองเตย', 'เขตสวนหลวง', 'เขตจอมทอง', 'เขตดอนเมือง', 'เขตราชเทวี',
  'เขตลาดพร้าว', 'เขตวัฒนา', 'เขตบางแค', 'เขตหลักสี่', 'เขตสายไหม', 'เขตคันนายาว',
  'เขตสะพานสูง', 'เขตวังทองหลาง', 'เขตคลองสามวา', 'เขตบางนา', 'เขตทวีวัฒนา',
  'เขตทุ่งครุ', 'เขตบางบอน',
];

// sync EMCS master ddlClm_Cause (verbatim 79 ตัว รวมคำที่ EMCS สะกดผิดเอง) 2026-07-25
export const ACC_CAUSE_OPTIONS = [
  '-- ระบุ --', 'ชนท้ายคู่กรณี', 'ชนคนบาดเจ็บ/เสียชีวิต', 'ชนรถคู่กรณีมีการบาดเจ็บ/เสียชีวิต',
  'ชน/เสียหลักหมุน/พลิกคว่ำ/ตกข้างทางมีผู้บาดเจ็บ/เสียชีวิต', 'ชนทรัพย์สินคู่กรณี',
  'ชนคู่กรณีในช่องทางสวน', 'ชนคู่กรณีและถูกชน', 'ถอยชนคู่กรณี', 'เฉี่ยว/เบียดคู่กรณี',
  'เปิดประตูชนรถคู่กรณี', 'ชนคู่กรณี/หรือถูกชนและไม่ทราบคู่กรณี',
  'เลี้ยว/กลับรถ/เปลี่ยนช่องทางชนคู่กรณี', 'ชนรถคู่กรณีไม่คุ้มครองรถประกัน',
  'ชนวัสดุ/สิ่งของ เช่น เสา,กำแพง,ประตู ฯลฯ', 'ชนฟุตบาท', 'ชนทรัพย์สินตนเอง', 'ชนสัตว์',
  'ทรัพย์สินหล่นใส่คู่กรณี', 'ผู้โดยสารตกรถ', 'เกี่ยวสายไฟฟ้า/โทรศัพท์/สายน้ำมัน',
  'เสียหลักล้ม', 'ฝากระโปรงหน้าเปิด', 'ยางระเบิด', 'ตกหลุม', 'ถูกน้ำมันเบรคราด', 'ประมาทร่วม',
  'ต่างฝ่ายต่างซ่อม', 'ช่วยเหลือมนุษยธรรม', 'รอคู่กรณีติดต่อ', 'รอตรวจสอบใบขับขี่',
  'แก๊สระเบิด', 'คู่กรณีชนท้าย', 'คู่กรณีชนแล้วหลบหนี', 'คู่กรณีเฉี่ยวชน',
  'คู่กรณีเฉี่ยวชนบุคคลในรถประกันบาดเจ็บ/เสียชีวิต', 'ชนสัตว์และเรียกร้องเจ้าของ',
  'คู่กรณีเปิดประตูชนรถประกัน', 'คู่กรณีถอยชน', 'คู่กรณีชน/ทรัพย์สินผู้เอาประกันเดียวกัน',
  'คู่กรณีกลั่นแกล้ง', 'ทรัพย์สินคู่กรณีหล่นใส่', 'เด็กปั๊มประมาทลืมปลดสายน้ำมัน',
  'ความเสียหายของรถประกันทีเกิดจากเหตุภายนอก', 'รถหายโดยการฉ้อฉล ตามสัญญาประกันภัย(A.P.HONDA)',
  'ไฟไหม้จากเหตุภายนอก', 'ถูกก้อนหิน', 'ถูกขูดขีด/กลั่นแกล้ง', 'วัตถุหล่นใส่',
  'รถหายตามสัญญาเช่าซื้อ', 'รถหายโดยการโจรกรรม', 'ไฟไหม้โดยระบบของตัวรถยนต์',
  'ไฟไหม้ที่เกิดจากการชน', 'น้ำท่วม', 'ภัยธรรมชาติอื่น ๆ', 'ลักทรัพย์อุปกรณ์/ส่วนควบ',
  'ภัยอื่น ๆ', 'ภัยก่อการร้าย', 'ไม่พบรถประกัน', 'ไม่พบรถคู่กรณี', 'ไม่พบรถประกัน/คู่กรณี',
  'รอผลคดี', 'รอตรวจสอบกรมธรรม์', 'รอเซ็นเคลม', 'รอรายงานอุบัติเหตุ', 'รอรถประกันติดต่อ',
  'เคลมซ้ำ', 'เปิดเคลมผิดพลาด', 'ฉ้อฉลจากการชน', 'รถหายโดยการฉ้อฉล', 'ไฟไหม้โดยการฉ้อฉล',
  'การยึดรถ ( A.P.HONDA )', 'เสียหายขณะจอดอยู่', 'กระจกบังลมหน้าแตก', 'กระจกอื่นๆ แตก',
  'รถประกันชนรถคู่กรณีไม่เอาความ', 'สูญเสียการควบคุม', 'หนูกัดสายไฟ',
  'การเสียชีวิตอ้นเกิดจากสาเหตุอื่นๆ', 'การเสียชีวิตอันเกิดจาการใช้รถ'
];

// sync EMCS master ddlLoss_ID (verbatim 21 ตัว ตามลำดับ EMCS) 2026-07-25
export const ACC_DAMAGE_TYPE_OPTIONS = [
  '-- ระบุ --', 'เคลมแห้ง', 'กระจกแตก', 'กระจกอื่นๆ แตก', 'ชนคู่กรณีเสียหาย', 'ถูกคู่กรณีชน',
  'ตกถนน', 'พลิกคว่ำ', 'รถประกันชนรถคู่กรณีไม่เอาความ', 'เฉี่ยวชนวัสดุ', 'ถูกขูดขีดกลั่นแกล้ง',
  'ถูกลักอุปกรณ์ส่วนควบ', 'วัสดุหล่นใส่', 'ยางระเบิด', 'จอดไว้ถูกชนไม่ทราบคู่กรณี',
  'หนูกัดสายไฟ', 'รถหาย', 'รถประกันไฟไหม้', 'น้ำท่วมเสียหาย', 'ชนคนบาดเจ็บ',
  'ผู้โดยสารประกันตกรถ', 'เสียหายทั้งหมด'
];

/*
 * ไม่มี POLICY_TYPE_OPTIONS แล้ว — "ประเภทกรมธรรม์" เป็นช่องพิมพ์ทั้งรถประกันและคู่กรณี
 *
 * เหตุผล: EMCS เองไม่มีรายการให้เลือก (รถประกัน = ป้ายอ่านอย่างเดียว `lblPolicy_Type`
 * คู่กรณี = ช่องพิมพ์ `txtPolicy_Type`) และของจริงมีนอกลิสต์ 7 ตัวที่เคยตั้งไว้ —
 * ใบแจ้งความเสียหายจริงเขียน "ประเภท 2+ ซ่อมอู่" คู่กับรหัส 52 ในไฟล์ใบเดียวกัน
 * เคสนำเข้าจึงเคยค้างเป็น "52 (ค่าเดิม)" เลือกไม่ได้
 * ที่เคยกลัวว่าพิมพ์เองแล้วค่าหาย แก้ที่ `policyTypeCode()` แล้ว (ส่งตามที่กรอก ไม่ดึงตัวเลข)
 */

export const EV_TYPE_OPTIONS = [
  { value: '0', label: '-- ระบุ --' },
  { value: 'BEV', label: 'BEV รถยนต์ไฟฟ้า BEV (100%)' },
  { value: 'FCEV', label: 'FCEV รถยนต์ไฟฟ้า เซลล์เชื้อเพลิง (FCEV)' },
  { value: 'HEV', label: 'HEV รถยนต์ไฟฟ้า ไฮบริด (HEV)' },
  { value: 'MEV', label: 'MEV รถยนต์ไฟฟ้าดัดแปลง (รถยนต์สันดาปที่ดัดแปลงเป็นรถไฟฟ้า)' },
  { value: 'PHEV', label: 'PHEV รถยนต์ไฟฟ้า ปลั๊กอินไฮบริด (PHEV)' },
];
