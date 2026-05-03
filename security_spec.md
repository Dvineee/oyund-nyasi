# Security Spec - Oyun Köşesi

## Veri Değişmezleri (Data Invariants)
1. Bir oyun odası (Room), geçerli bir `hostId` (sahip ID) ve en az bir oyuncu içermelidir.
2. Sohbet mesajları sadece odadaki mevcut oyuncular tarafından gönderilebilir.
3. Tic-Tac-Toe oyununda hamleler sadece sırası gelen oyuncu tarafından ve boş karelere yapılabilir.
4. Bir kullanıcı sadece bir odada aktif olabilir (opsiyonel ama güvenlik için iyi).

## "Kirli On İki" Paylantıları (The Dirty Dozen Payloads)
1. Sahibi olunmayan bir odayı silme girişimi.
2. Dolu bir odaya zorla oyuncu ekleme (maksimum kapasite aşımı).
3. Başka bir kullanıcının `hostId`'sini kullanarak oda oluşturma.
4. Kapalı veya başlamış bir oyunda sırayı bozarak hamle yapma.
5. Oda ID'si yerine devasa bir string göndererek kaynak tüketme (DoS).
6. Sohbet mesajına script enjekte etme (XSS - Frontend korumalı olsa da database düzeyinde boyut kontrolü).
7. Başkasının mesajını silme veya düzenleme.
8. `updatedAt` zaman damgasını manipüle etme.
9. Bir odada olmayan birinin o odanın mesajlarını okuması.
10. Oyun bittikten sonra hamle yapmaya devam etme.
11. Nickname alanına aşırı büyük veri gönderilmesi.
12. Odanın durumunu (status) yetkisiz bir şekilde 'playing'e çekme.

## Testler
(Test dosyası firestore.rules.test.ts olarak hazırlanacaktır)
