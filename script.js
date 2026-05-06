// Mermaid kütüphanesini sayfa yüklenir yüklenmez çalışmaması için ayarlıyoruz.
// Biz ağacı kendimiz oluşturduğumuzda başlatacağız.
mermaid.initialize({ startOnLoad: false, theme: 'default' });

// İstatistikleri global bir objede tutuyoruz ki farklı fonksiyonlardan erişebilelim.
let statsData = {}; 

// Butona tıklandığında çalışan Ana Fonksiyon
function processData() {
    // Kullanıcının girdiği metni al ve sağındaki/solundaki boşlukları temizle (trim)
    const text = document.getElementById('inputText').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    
    // Eğer metin girilmediyse hata ver ve fonksiyonu durdur
    if (text.length === 0) {
        errorMsg.innerText = "Lütfen bir metin giriniz!";
        return;
    }
    errorMsg.innerText = ""; // Hata yoksa mesajı temizle

    // Gizli olan sonuç kartlarını görünür yap (CSS'teki display:none ayarını eziyoruz)
    document.getElementById('statsCard').style.display = 'block';
    document.getElementById('huffmanCard').style.display = 'block';
    document.getElementById('lzwCard').style.display = 'block';
    
    // Önceki aramadan kalan verileri temizle
    document.getElementById('lzwTableBody').innerHTML = "";
    
    // Orijinal dosya boyutunu hesapla (Her karakter ASCII'de 8 bit yer kaplar)
    statsData.originalSize = text.length * 8; 
    statsData.originalLength = text.length;

    // Algoritmaları çalıştır
    runHuffman(text);
    runLZW(text);
}

// ======================
// LZW ALGORİTMASI
// ======================
function runLZW(text) {
    // 1) Metindeki benzersiz karakterleri bul ve alfabetik olarak sırala
    let uniqueChars = [...new Set(text.split(''))].sort();
    
    let dictionary = {}; // Sözlüğümüz
    let dictSize = 1;    // Sözlükteki kelimelere vereceğimiz başlangıç indeksi
    let initialDictStr = "";

    // 2) Başlangıç sözlüğünü (Initial Dictionary) oluştur
    // Örn: a:1, b:2, c:3 vb.
    uniqueChars.forEach(char => {
        dictionary[char] = dictSize;
        initialDictStr += `${char}:${dictSize}, `;
        dictSize++;
    });

    let outputTableHtml = "";
    let temp = text[0]; // Algoritmanın tuttuğu geçici (Temp) dizi, ilk harf ile başlar.
    let step = 1;
    let finalOutputCodes = []; // Çıktı kodlarını tutacağımız dizi

    // 1. Adımı manuel olarak tabloya ekliyoruz (Genelde çıktı olmaz)
    outputTableHtml += `<tr>
        <td>${step++}</td><td>${temp}</td><td>${temp}</td>
        <td>Y</td><td>${temp}</td><td>-</td><td>-</td>
    </tr>`;

    // 3) Metnin 2. karakterinden başlayarak sonuna kadar dön
    for (let i = 1; i < text.length; i++) {
        let char = text[i]; // Sıradaki karakter
        let tempChar = temp + char; // Mevcut temp ile sıradaki karakteri birleştir
        let inTable = dictionary.hasOwnProperty(tempChar); // Bu birleşim sözlükte var mı?
        
        let outputCode = "-";
        let atd = "-";
        let newTemp = "";

        // Eğer sözlükte varsa, çıktı verme, sadece temp'i güncelle
        if (inTable) {
            newTemp = tempChar;
        } 
        // Eğer sözlükte YOKSA:
        else {
            newTemp = char; // Temp'i yeni karakter yap
            dictionary[tempChar] = dictSize; // Yeni birleşimi sözlüğe ekle
            atd = `${tempChar} (${dictSize})`; // "Sözcüğe Ekle" sütunu için metin oluştur
            outputCode = `${dictionary[temp]} (${temp})`; // Eski temp'in kodunu çıktı olarak ver
            finalOutputCodes.push(outputCode); // Çıktıyı diziye kaydet
            dictSize++; // Sözlük indeksini bir artır
        }

        // Hesaplanan değerleri HTML tablosuna yeni bir satır olarak ekle
        outputTableHtml += `<tr>
            <td>${step++}</td><td>${char}</td><td>${tempChar}</td>
            <td>${inTable ? 'Y' : 'N'}</td><td>${newTemp}</td><td>${atd}</td>
            <td>${outputCode !== "-" ? outputCode : "-"}</td>
        </tr>`;
        
        temp = newTemp; // Bir sonraki döngü için temp'i güncelle
    }

    // 4) Döngü bittiğinde Temp içinde kalan son parçayı çıktı olarak ver
    let lastOutput = `${dictionary[temp]} (${temp})`;
    finalOutputCodes.push(lastOutput);
    outputTableHtml += `<tr>
        <td>${step}</td><td>(son)</td><td>-</td>
        <td>-</td><td>-</td><td>-</td>
        <td><strong>${lastOutput}</strong></td>
    </tr>`;

    // Sonuçları ekrana (HTML'e) yazdır
    document.getElementById('lzwDetails').innerHTML = `
        <strong>Başlangıç Sözlüğü:</strong> ${initialDictStr.slice(0, -2)} <br>
        <strong>Sonuç (Çıktı Kodları):</strong> ${finalOutputCodes.join(', ')}
    `;
    document.getElementById('lzwTableBody').innerHTML = outputTableHtml;

    // 5) LZW Sıkıştırma Oranını (Tasarruf) Hesapla
    statsData.lzwOutputLength = finalOutputCodes.length;
    // Formül: ((Orijinal Uzunluk - Çıktı Uzunluğu) / Orijinal Uzunluk) * 100
    let lzwSaving = ((statsData.originalLength - statsData.lzwOutputLength) / statsData.originalLength * 100).toFixed(1);
    
    // İstatistik panelini güncelle
    updateStatsDisplay(lzwSaving);
}

// =========================
// HUFFMAN ALGORİTMASI
// =========================

// Ağaç yapısı için Düğüm (Node) Sınıfı
class Node {
    constructor(char, freq, left = null, right = null) {
        this.char = char; // Karakter (Kök düğümlerde null olur)
        this.freq = freq; // Frekans (Tekrar sayısı)
        this.left = left; // Sol çocuk düğüm
        this.right = right; // Sağ çocuk düğüm
    }
}

function runHuffman(text) {
    // 1. Karakter Frekanslarını (Tekrar sayılarını) hesapla
    let freqMap = {};
    for (let char of text) {
        freqMap[char] = (freqMap[char] || 0) + 1;
    }

    // Frekansları kullanarak Düğümler (Nodes) oluştur
    let nodes = [];
    let freqsStr = [];
    for (let char in freqMap) {
        nodes.push(new Node(char, freqMap[char]));
        freqsStr.push(`${char}: ${freqMap[char]}`);
    }

    // Ağaç oluşturmak için en az 2 karakter lazım, hata kontrolü:
    if (nodes.length === 1) {
        document.getElementById('huffmanDetails').innerHTML = "Huffman ağacı için en az 2 farklı karakter gereklidir.";
        document.getElementById('mermaidContainer').innerHTML = "";
        return;
    }

    // 2. Ağacı (Tree) Aşağıdan Yukarıya İnşa Et
    while (nodes.length > 1) {
        // Frekansı en küçük olanları başa al (Sırala)
        nodes.sort((a, b) => a.freq - b.freq);
        let left = nodes.shift(); // En küçük 1. elemanı çıkar (Sol dal)
        let right = nodes.shift(); // En küçük 2. elemanı çıkar (Sağ dal)
        
        // Bu iki elemanı birleştirip yeni bir ebeveyn (parent) düğüm oluştur
        let parent = new Node(null, left.freq + right.freq, left, right);
        nodes.push(parent); // Ebeveyni listeye geri ekle
    }

    let root = nodes[0]; // Kalan son eleman ağacın köküdür (Root)
    let huffmanCodes = {}; // Hesaplanan 0 ve 1 kodlarını burada tutacağız

    // 3. Ağaç üzerinde gezinerek (Recursive) 0 ve 1 kodlarını üret
    function generateCodes(node, currentCode) {
        if (!node) return;
        // Eğer bu düğümde bir karakter varsa, ulaşılan kodu kaydet
        if (node.char !== null) huffmanCodes[node.char] = currentCode;
        
        // Sola giderken koda "0" ekle, sağa giderken "1" ekle
        generateCodes(node.left, currentCode + "0");
        generateCodes(node.right, currentCode + "1");
    }
    generateCodes(root, ""); // Kökten aramaya başla

    // 4. Orijinal metni Huffman kodlarıyla şifrele (Encode)
    let encodedText = "";
    for (let char of text) encodedText += huffmanCodes[char];

    // 5. Huffman Sıkıştırma Oranını (Tasarruf) Hesapla
    statsData.huffmanSize = encodedText.length; // Şifrelenmiş metnin uzunluğu bit sayısını verir
    let huffmanSaving = ((statsData.originalSize - statsData.huffmanSize) / statsData.originalSize * 100).toFixed(1);
    statsData.huffmanSaving = huffmanSaving;

    // ==========================================
    // MERMAID İLE AĞAÇ ÇİZİMİ (GÖRSELLEŞTİRME)
    // ==========================================
    let mermaidGraph = "graph TD\n"; // Yukarıdan aşağıya (Top-Down) grafik
    let nodeIdCounter = 0; // Her düğüme benzersiz bir ID vermek için sayaç

    // Ağacı gezerek Mermaid dilinde kod oluşturur
    function traverseMermaid(node) {
        let myId = "N" + nodeIdCounter++;
        // Yaprak düğümse karakteri ve frekansı yaz, değilse sadece toplam frekansı yaz
        let label = node.char !== null ? `"${node.char}: ${node.freq}"` : `"${node.freq}"`;
        mermaidGraph += `    ${myId}(${label})\n`;
        
        // Renklendirme: Karakter içeren düğümler mavi, ara toplam düğümleri pembe
        mermaidGraph += `    style ${myId} fill:${node.char !== null ? '#bbf' : '#f9f'},stroke:#333,stroke-width:2px\n`;

        // Sol dal varsa araya "0" yazarak bağla
        if (node.left) {
            let leftId = traverseMermaid(node.left);
            mermaidGraph += `    ${myId} -->|0| ${leftId}\n`;
        }
        // Sağ dal varsa araya "1" yazarak bağla
        if (node.right) {
            let rightId = traverseMermaid(node.right);
            mermaidGraph += `    ${myId} -->|1| ${rightId}\n`;
        }
        return myId;
    }

    traverseMermaid(root); // Çizim kodunu kökten başlat

    // Huffman detaylarını ekrana yazdır
    let codesStr = "";
    for(let c in huffmanCodes) codesStr += `${c}=${huffmanCodes[c]}, `;

    document.getElementById('huffmanDetails').innerHTML = `
        <strong>Frekanslar:</strong> ${freqsStr.join(', ')} <br>
        <strong>Karakter Kodları:</strong> ${codesStr.slice(0, -2)} <br>
        <strong>Şifrelenmiş Metin (Encoded):</strong> <span style="word-break: break-all;">${encodedText}</span>
    `;

    // Oluşturulan Mermaid kodunu HTML'e bas ve kütüphaneye "Şimdi Çiz!" komutunu ver
    const container = document.getElementById('mermaidContainer');
    container.innerHTML = `<div class="mermaid">${mermaidGraph}</div>`;
    mermaid.init(undefined, container.querySelectorAll('.mermaid'));
}

// ==========================================
// İSTATİSTİKLERİ VE FORMÜLLERİ EKRANA YAZDIRMA
// ==========================================
function updateStatsDisplay(lzwSaving) {
    document.getElementById('statsDetails').innerHTML = `
        <div class="stats-box">
            <strong>Orijinal Metin</strong>
            <span>${statsData.originalSize} bit</span>
            <small>${statsData.originalLength} karakter × 8 bit</small>
        </div>
        <div class="stats-box">
            <strong>Huffman Tasarrufu</strong>
            <span>%${statsData.huffmanSaving}</span>
            <small>( (${statsData.originalSize} - ${statsData.huffmanSize}) / ${statsData.originalSize} ) × 100</small>
        </div>
        <div class="stats-box">
            <strong>LZW Tasarrufu</strong>
            <span>%${lzwSaving}</span>
            <small>( (${statsData.originalLength} - ${statsData.lzwOutputLength}) / ${statsData.originalLength} ) × 100</small>
        </div>
    `;
}