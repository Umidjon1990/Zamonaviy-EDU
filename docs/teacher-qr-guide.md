# O‘qituvchi QR davomati — foydalanish

## Birinchi sozlash
1. Admin: **O‘qituvchi davomati → Xarita va QR**.
2. Manzilni qidiring yoki xaritani bosing. Belgini markaz kirishiga suring.
   **Hozirgi joylashuvim** ham mavjud. 50 metr doirani tekshiring.
3. Kechikish imtiyozi boshlanishda 5 daqiqa; kelish birinchi darsdan 30 daqiqa oldin ochiladi.
4. Dastlab **Sinov rejimi** bilan **QR davomatni yoqish**ni belgilang va saqlang.
   Yangi tizim dastlab o‘chiq. Aniqlanmagan koordinata o‘rniga taxminiy manzil qo‘yilmaydi.
5. QR rasmni PNG yuklab olib, chop eting. U doimiy, avtomatik yangilanmaydi.
6. **Dars jadvali**da barcha guruhlarning boshlanish/tugash va xona ma’lumotlarini tekshiring.
   Noaniq eski vaqtlar alohida ogohlantirishda chiqadi. Oddiy jadval tahriri sanadan amal qiladi;
   bugungi qayd etilgan dars alohida istisno orqali tahrirlanadi.

## Qurilma va skanerlash
- O‘qituvchi: **QR / Keldi-kettim** bo‘limida telefoniga nom qo‘yib ulash so‘rovini yuboradi.
- Admin: **Qurilmalar**da shu so‘rovni tasdiqlaydi. Avvalgi faol qurilma bekor qilinadi.
- O‘qituvchi shu brauzerda kamera va lokatsiyaga ruxsat berib **Keldim — QR**ni bosadi.
- **Ketdim — QR** oxirgi dars tugagach ishlaydi. Takror skan yangi qayd yaratmaydi.
- Telefon, brauzer almashtirilsa yoki sayt ma’lumotlari o‘chirilsa admin qayta ulaydi.
- Face ID, barmoq izi va passkey talab qilinmaydi. Bu brauzerga ishonch modeli;
  telefonni boshqa odamga berishni yoki soxta GPSni mutlaq to‘xtatish kafolati yo‘q.
- GPS 30 soniyadan eski yoki aniqligi 50 metrdan yomon bo‘lsa, qayta o‘lchash so‘raladi.
  Muammo qolsa admin sabab bilan davomatni tuzatadi. Kechikish telefon soati bilan hisoblanmaydi.

## Jadval va istisnolar
- Kun/hafta/oy ko‘rinishi, o‘qituvchi/xona filtri va guruh qidiruvi mavjud.
- Jadval tuzishda xona va o‘qituvchi vaqt to‘qnashuvlari tekshiriladi.
- Darsdagi qalam tugmasi faqat shu kun uchun bekor qilish, bayram, o‘rinbosar yoki vaqtni o‘zgartiradi.
- Guruhning doimiy o‘qituvchisi jadval versiyasida belgilangan sanadan almashadi.
  Oldingi to‘lovlarning teacher_earning va o‘qituvchi ulushlari qayta yozilmaydi.
- Ruxsat/texnik xato **Davomat → Ruxsat / qaydni tuzatish** orqali izoh bilan qayd etiladi.
- Kunlik kirish-chiqish har bir dars alohida o‘tilganining isboti emas.

## Jarimalar
- Kechikish: 100000 so‘m; kun davomida kelish qaydi yo‘qligi: 200000 so‘m.
- Avtomatik yozuv kuniga bir marta yaratiladi; kelmaslik oxirgi darsdan keyin aniqlanadi.
- Ketishni unutish kelmaslik jarimasiga aylantirilmaydi. Dars yo‘q/bekor/ruxsat holatlari hisobga olinadi.
- Xona tozaligi, zalda yurish va tartibsizlik turlari qo‘lda, aniq izoh bilan qayd etiladi.
  Noaniq nomlarni markazning ichki mezonlariga moslab tahrirlang.
- O‘qituvchi **Jarimalarim**da tushuntirish yoki e’tiroz yuboradi.
- Sinovda yaratilgan jarima keyinchalik ham oylikka qo‘llanmaydi.
- Tasdiqlash uchun tushuntirish/rad etish dalolatnomasi, buyruq, tanishtirish qaydi,
  o‘rtacha oylik va tegishli jarima chegarasi kiritiladi. Ilovadagi tugma yuridik imzo emas.
- Tasdiqlangan jarimaga e’tiroz bo‘lsa, yangi ushlash ko‘rib chiqishgacha to‘xtatiladi.
  Admin tasdiqlashi yoki bekor qilishi mumkin. Qarorlar tarixda saqlanadi.

## Oylik va to‘lov
- Adminning Moliya hisoboti, yangi Oylik bo‘limi va o‘qituvchi hisoboti yagona hisobdan foydalanadi.
- Haq completed, o‘chirilmagan to‘lovlarda saqlangan teacher_earning yig‘indisidan olinadi.
- Jarima real chiqim sifatida ikkinchi marta yozilmaydi. Ushlanma chegarasi va to‘lanadigan qoldiq tekshiriladi.
- **Oy hisobini yopish** faqat oy tugagach ochiladi. Har bir jarimaning qo‘llangan qismi alohida yoziladi.
  Chegaradan ortgan qismi keyingi hisobda admin tomonidan ko‘rib chiqiladi.
- To‘lovni **Xarajatlar → O‘qituvchi oyligi** sifatida kiriting. **Qaysi oy oyligi / avansi**
  maydoni to‘lov keyingi oyda berilganda ham uni kerakli hisobga bog‘laydi.
  Chiqim sanasi esa pulning amalda berilgan kunini saqlaydi.
- Yopilgan hisobning haq va jarima nusxasi saqlanadi; keyingi real to‘lov qoldiqni kamaytiradi.
- Ushlangan jarima bekor qilinsa, alohida qaytarish yozuvi keyingi hisobga o‘tadi.

## Texnik ishga tushirish
- Yangi jadvallar va expenses.payroll_period kengaytiruvchi startup migratsiyasida yaratiladi.
- Mavjud balans va tarixiy to‘lov summalari qayta hisoblanmaydi. Yangi maxfiy env o‘zgaruvchisi kerak emas.
- Mavjud foydalanuvchi sessiyasi, markaz obunasi va rol tekshiruvlari yangi API uchun ham ishlaydi.
- QR sirini log yoki umumiy xabarga qo‘ymang; qurilma siri HttpOnly cookie va server xeshi bilan ishlaydi.
- Manzil qidiruvi Nominatim, xarita OpenStreetMap orqali. Qidiruv tugma bilan bajariladi va cheklanadi.
- QR kamerasi va lokatsiya haqiqiy HTTPS domenida sinovdan o‘tkaziladi. Avtomatlashtirilgan virtual
  kamera/GPS tekshiruvi haqiqiy telefonning apparat sinovi o‘rnini bosmaydi.
