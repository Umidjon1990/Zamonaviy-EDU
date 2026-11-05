# Zamonaviy CRM Face ID terminali

Markaz kirishidagi kamera bilan ishlaydigan dastur. O‘qituvchi ro‘yxatdan ismini tanlaydi, **Keldim** yoki **Ketdim** tugmasini bosadi va ekrandagi ko‘rsatmaga amal qiladi. Terminal tanlangan o‘qituvchining andozasini jonli yuz bilan solishtiradi. CRM tasdiqlangan qaydga server vaqti va dars jadvalini qo‘llaydi. Ketish oxirgi dars tugagach ochiladi.

## Terminalni tayyorlash

Windows 10 yoki 11 kompyuterida Python 3.12, Tkinter, USB yoki ichki kamera va CRM’ga HTTPS aloqa kerak. Terminal uchun alohida OS hisobi oching, disk shifrlash va avtomatik soat sinxronlashni yoqing. Kamera ruxsati, yorug‘lik va ulanishni sinovdan oldin tekshiring. Terminalga jismoniy kirish va OS sozlamalarini administrator boshqaradi. Terminal ma’lumotlar papkasini bulut sinxronlash va zaxira nusxalaridan chiqaring.

Repo ichidagi `face-terminal` papkasidan PowerShell’da bajaring. CRM’ning sinov muhiti manzilini qo‘ying.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python models.py
.\.venv\Scripts\python kiosk.py --crm https://crm-sinov-manzili
```

Model fayllari birinchi sozlashda yuklanadi va har safar ochilganda nazorat summasi tekshiriladi. Keyingi ishga tushirishda saqlangan CRM manzili olinadi. Ikkinchi kamera uchun `--camera 1` parametridan foydalaning. macOS va Linux’da Python 3.12, Tkinter va tizimning himoyalangan kalit ombori kerak. Windows’dagi haqiqiy qurilma sinovi pilotning bir qismi.

## Admin uchun ish tartibi

1. **O‘qituvchilar davomati → Face ID terminali** bo‘limida terminal nomini kiriting va ulash kodi yarating. Terminalda **Terminalni ulash** tugmasini bosing va kodni kiriting. Kod 10 daqiqa amal qiladi. Markazga bitta terminal ulanadi.
2. **Sozlamalar** bo‘limida avvalgi QR sozlamasi bor markazni Face ID’ga o‘tkazing. Face ID yangi markazlarda tanlangan bo‘ladi.
3. O‘qituvchi o‘z kabinetida **Keldi-kettim → Face ID davomat** bo‘limiga kiradi, rozilikni belgilaydi va bir martalik kod oladi. Markaz terminalida **Yuzni ro‘yxatga olish**ni bosib, kodni o‘zi kiritadi. Ismini tasdiqlaydi va ekrandagi bosh harakati ko‘rsatmasiga amal qiladi. Kod 10 daqiqa amal qiladi. Terminal va kamida bitta faol ro‘yxat mavjud bo‘lgach, admin davomatni yoqadi. Birinchi yoqishda sinov rejimi majburiy.
4. 2–3 o‘qituvchi bilan pilot o‘tkazing. Vaqtida va kech kelish, oxirgi darsdan oldin va keyin ketish, bir amalni takrorlash, boshqa odam, chop etilgan surat va telefon videosini sinang. Turli yorug‘lik, ko‘zoynak, kamera uzilishi va internet uzilishi holatlarini ham sinang. Jonli odam rad etilgan yoki surat yoxud video qabul qilingan holatni yozib boring va sababini aniqlashtiring.
5. Terminalda tasdiq bo‘lmasa **Davomat → Ruxsat / qaydni tuzatish** orqali dalil bilan qayd kiriting. Face ID rejimida kelish tasdig‘i yo‘qligi tekshiruv holati bo‘ladi. Kelmaganlik jarimasini admin sababni tekshirib, mavjud jarima bo‘limidan rasmiylashtiradi. Tasdiqlangan kechikish uchun loyiha tuziladi. Sinov jarimalari oylikka qo‘llanmaydi.
6. Keyingi kelish va ketishlarda o‘qituvchi shu andozadan foydalanadi. O‘qituvchi kabinetidan roziligini bekor qilishi mumkin. Admin xavfsizlik uchun ro‘yxatni bekor qilsa, qayta ro‘yxatga olishni admin boshlaydi. CRM bekor qilingan andoza bilan yangi qaydlarni rad etadi va terminal navbatdagi muvaffaqiyatli yangilanishida mahalliy andozani o‘chiradi. Terminal almashtirilganda avval eski terminalni CRM’da bekor qiling. Aloqaga chiqmaydigan eski qurilmada terminalni yoping va o‘sha OS hisobida `kiosk.py --erase-local` orqali andozalar va kalitlarni o‘chiring.

Birinchi ro‘yxatni kabinet sessiyasi va terminalda ishlatiladigan kod bog‘laydi. O‘qituvchi kodni shaxsan ishlatadi va boshqalarga bermaydi. Zarurat tug‘ilsa, admin rozilik hujjati bilan ro‘yxatdan o‘tkazishda yordam berishi mumkin.

## Qaydlar va andozalar

Yuz andozasi terminaldagi SQLite bazasida AES-256-GCM bilan shifrlanadi. Shifrlash va Ed25519 imzo kalitlari OS kalit omborida turadi. Kamera kadrlari ishlov berish vaqtida xotirada bo‘ladi. CRM terminal imzosi bilan o‘qituvchi va ro‘yxat identifikatori, kelish yoki ketish amali va texnik muammo kodini qabul qiladi. Jadval, vaqt va oylik qoidalarini CRM tekshiradi.

Yuz mosligi uchun boshlang‘ich kosinus chegarasi 0,50. Jonli tasvir uchun boshlang‘ich ehtimol chegarasi 0,90 va bosh harakati tekshiriladi. Ushbu chegaralar kirishdagi kamera va pilot natijalari bilan tekshiriladi. Yuz tekshiruvi muvaffaqiyatsiz bo‘lganda yoki aloqa bo‘lmaganda o‘qituvchiga admin bilan bog‘lanish yo‘li ko‘rsatiladi.

Modellar manbasi va litsenziyasi

- [OpenCV Zoo YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) · MIT
- [OpenCV Zoo SFace](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface) · Apache 2.0
- [Open Model Zoo anti-spoof-mn3](https://github.com/openvinotoolkit/open_model_zoo/tree/master/models/public/anti-spoof-mn3) · [MIT](https://github.com/kprokofi/light-weight-face-anti-spoofing/blob/master/LICENSE)

## Dasturchi tekshiruvlari

CRM uchun repo ildizida `npm run build` buyrug‘ini bajaring. Terminal uchun `face-terminal` papkasidan virtual muhit Python’i bilan `python -m unittest` buyrug‘ini bajaring. Avtomatik tekshiruvlar imzo, lokal shifrlash va CRM’dagi davomat qoidalarini qamrab oladi. Pilotda real kamera va o‘qituvchilar bilan sinov o‘tkaziladi.
