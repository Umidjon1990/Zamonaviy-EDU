# Zamonaviy CRM: o‘qituvchi QR davomati — bajarish topshirig‘i

2026-11-02. QR usulining tarixiy topshirig‘i. Face ID talablari va ish tartibi [terminal qo‘llanmasida](../face-terminal/README.md) keltirilgan.

## Maqsad
Umidjon1990/Zamonaviy-EDU loyihasida dars jadvali, o‘qituvchi keldi-kettisi,
jarimalar va oylikni yagona, markazlar bo‘yicha ajratilgan tizimga birlashtir.
Mavjud o‘quvchilar davomati va moliyaviy operatsiyalarni buzma.

## Majburiy talablar
1. QR doimiy rasm bo‘lsin. Admin PNG yuklab olib chop etsin. Aylanadigan QR,
   Face ID, biometrika va majburiy passkey qo‘shilmasin.
2. Markaz xaritada qidiruv, bosish, belgi surish va hozirgi lokatsiya yordamida
   tanlansin. 50 metr doira ko‘rsatilsin. Koordinatalar admin tasdiqlamaguncha
   taxminiy manzilni ishchi lokatsiya deb saqlama.
3. Bir o‘qituvchiga bitta faol davomat qurilmasi. Birinchi ulash admin tomonidan
   tasdiqlansin; almashtirishda eskisi bekor qilinsin. HttpOnly tasodifiy qurilma
   siri serverda xeshlangan holda tekshirilsin; IP/UA jismoniy qurilma kafolati emas.
   Telefon/brauzerga asoslangan ishonch chegarasini hujjatlashtir.
4. Kamera orqali kabinet ichida QR o‘qilsin. Server sessiyadagi o‘qituvchi,
   markaz QR kodi, faol qurilma, yangi/aniq GPS, masofa, jadval va server vaqtini
   tekshirsin. Mijoz yuborgan teacherId/tenantId/vaqtga ishonma.
5. Birinchi darsdan 30 daqiqa oldin kelish ochilsin. Kechikish uchun boshlang‘ich
   5 daqiqa imtiyoz, admin sozlamasi. Ketish faqat oxirgi dars tugagach.
   Har o‘qituvchi/ish kuni uchun takror skan bir xil natijani qaytarsin.
6. Kunlik kelish va ketishning o‘zi har bir dars o‘tilganini isbotlamasligini saqla.
   Ruxsat, bayram, bekor qilingan dars, ko‘chirish va o‘rinbosar uchun jadval
   istisnolari bo‘lsin. Skan yo‘qligi avtomatik ravishda tasdiqlangan ayb emas.
7. Jadvalni yagona xizmatdan ber: bugun/hafta/oy, o‘qituvchi/xona/guruh filtrlari,
   boshlanish/tugash, to‘qnashuv nazorati, amal qilish sanasi va tarix.
   Mavjud guruh jadvalidan xavfsiz import qil, noaniq vaqtni tekshiruvga chiqar.
   Tarixiy dars nusxalari jadval keyin o‘zgarganda o‘zgarmasin.
8. Admin bosh sahifasida bugungi darslar, kelish-ketish, kechikish va tekshiruvlar.
   O‘qituvchi kabinetida QR davomat, keldi-kettim, jadvalim, jarimalarim.
9. Jarima turlari: kelmaslik 200000; kechikish 100000; xona toza emas 100000;
   «Dars zalda yurish» 100000; «O‘qituvchilari tartibsiz» 100000.
   Oxirgi ikki mezon admin tomonidan aniqlashtiriladigan qo‘lda qo‘llanadigan
   turlar bo‘lsin. Turlarni qo‘shish/tahrirlash/arxivlash mumkin bo‘lsin.
10. Tizim kechikish/kelmaslik uchun takrorlanmaydigan jarima loyihasini yaratsin.
    Yozma tushuntirish, admin qarori, buyruq rekviziti/tanishtirish qaydi bilan
    tasdiqlash, rad etish, bekor qilish, e’tiroz va audit tarixi bo‘lsin.
    Bir kun uchun kechikish va umuman kelmaslik birgalikda qo‘llanmasin.
    Ketishni unutish uchun kelmaganlik jarimasini yozma.
11. Summalar jarima paytidagi nusxada saqlansin. Eski tur summasini tahrirlash
    tarixiy jarimalarni o‘zgartirmasin. Faqat tasdiqlangan jarimalar oylikka tushsin.
12. Oylikning barcha ko‘rinishlari yagona hisobdan foydalansin: tarixiy
    teacher_earning yig‘indisi, to‘langan avanslar, qonuniy qo‘llangan jarimalar,
    qolgan haq. Jarima pul chiqimi sifatida qayta yozilmasin. Mavjud to‘lovlar,
    o‘quvchi balanslari va foiz nusxalarini o‘zgartirma. Ushlanma cheklovi,
    qo‘llanmagan qoldiq va hisobni yopish nazorati bo‘lsin.
13. Barcha vaqt chegaralari Asia/Tashkent bo‘yicha. Fon vazifasi restartdan keyin
    o‘tgan ish kunlarini davom ettirsin; DB unique indekslari va tranzaksiyalar
    takror jarima, takror skan va ikki marta ushlashni to‘xtatsin.
14. Bir markaz boshqa markaz ma’lumotini ko‘rmasin. O‘qituvchi faqat o‘zini,
    admin faqat o‘z markazini boshqarsin. Mutatsiyalar sessiya va rol bilan
    himoyalansin; sirlar API javoblari/loglarda tarqalmasin.
15. Boshlanishda davomat o‘chirilgan/sinov rejimida bo‘lsin. Admin xarita va
    jadvalni tekshirib yoqadi. Yopilgan oy qayta yozilmasin.

## Ish tartibi va qabul mezonlari
- Alohida feature branch; kengaytiruvchi, qayta ishga tushirishga chidamli migratsiya.
- Avval sof qoidalar va tranzaksiyali server; so‘ng kabinet, admin, xarita, skaner.
- Haqiqiy PostgreSQL semantikali PGlite testlar: tenant/rol, 50m, GPS eskirishi,
  noto‘g‘ri QR, qurilma, vaqt chegarasi, takror so‘rov, istisnolar, kechikish,
  kelmaslik, e’tiroz, jarima qarori, oylik, limit, bekor qilish va tarix.
- TypeScript, mavjud regression testlari va production build o‘tsin.
- UI mobil/desktopda tekshirilsin. Jonli kamera/GPS telefon sinovi talab qilinishi
  alohida qayd etilsin; emulyatsiya haqiqiy qurilma sinovi deb aytilmasin.
- Yakunda kod, tekshiruv dalili, foydalanish yo‘riqnomasi va zarur markaz sozlamalari
  tayyor bo‘lsin. Ishlab turgan bazada avvalgi pul summalarini qayta hisoblama.

## Chegaralar
Bu veb-brauzerga ishonch modeli: telefonni PIN bilan boshqa odamga berishni,
brauzer profilini ko‘chirishni yoki soxta GPSni mutlaq bartaraf qilmaydi.
Qurilma siri oddiy foydalanuvchi matni yoki faqat localStorage ID bo‘lmasin.
Mehnat kodeksi 269–270, 312–314 talablariga mos rasmiylashtirish imkoniyati
beriladi; ilova ichidagi tasdiqning o‘zi yuridik imzo o‘rnini bosadi deb ko‘rsatilmasin.
