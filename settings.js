const fs = require('fs');
const chalk = require('chalk');

//~~~~~~~~~~~~< GLOBAL SETTINGS >~~~~~~~~~~~~\\

global.owner = ['6287872363060'] //['628','628'] 2 owner atau lebih
global.number_bot = '6282191541450' // untuk nomor botnya isi sesuai format. contoh '62812345xxxx'
global.author = 'developing debug' // nama owner
global.botname = 'debug bot' // nama bot
global.packname = 'Bot WhatsApp' // nama pack sticker


/*
- Setting Author, Packname, Botname sekarang pakai command
- Walau sudah diganti tidak berubah
- setbotauthor, setbotpackname, setbotname
*/
global.listprefix = ['+','!','.']
global.listv = ['•','●','■','✿','▲','➩','➢','➣','➤','✦','✧','△','❀','○','□','♤','♡','◇','♧','々','〆']
global.tempatDB = 'mongodb+srv://develop:Abul~Basar132@cluster0.58zkxb8.mongodb.net/?appName=Cluster0' // Taruh url mongodb di sini jika menggunakan mongodb. Format : 'mongodb+srv://...'
global.tempatStore = 'baileys_store.json' // Taruh url mongodb di sini jika menggunakan mongodb. Format : 'mongodb+srv://...'
global.pairing_code = true
global.fake = {
	anonim: 'https://telegra.ph/file/95670d63378f7f4210f03.png',
	thumbnailUrl: 'https://telegra.ph/file/fe4843a1261fc414542c4.jpg',
	thumbnail: fs.readFileSync('./src/media/qris.jpg'),
	docs: fs.readFileSync('./src/media/fake.pdf'),
	listfakedocs: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/pdf'],
}

//------------- jadibotv1 settings --------------\\
global.domain = 'https://n.izhar.my.id';
global.apikey = "ptla_P8nes4Pw4vefLUKOj5JjKk263LeS0nxDuUcbsG7FHJW";
global.capikey = "ptlc_lAe2I1r3SyPh5q9lyYlOyvEGAYwMWFC7ntpydQD2xDo";
global.eggsnya = "16"; // id eggs yang dipakai
global.location = "1"; // id location
global.thumb = 'https://izharelop.github.io/database/property/img/logo_inv.jpg' // THUMBAIL DARI PANEL
global.nodejs = "ghcr.io/parkervcp/yolks:nodejs_24";
global.excludedServerIdsPrivate = ["1"]; // Ganti dengan ID server owner
//--------------------------------------------------------------------------------------------------------

global.my = {
	yt: 'https://youtube.com/c/',
	gh: 'https://github.com/',
	gc: 'https://chat.whatsapp.com/',
	ch: '@newsletter',
}

global.limit = {
	free: 20,
	premium: 999,
	vip: 9999
}

global.money = {
	free: 10000,
	premium: 1000000,
	vip: 10000000
}

global.mess = {
	key: 'Apikey mu telah habis silahkan kunjungi\nhttps://my.hitori.pw',
	owner: 'Fitur Khusus Owner!',
	admin: 'Fitur Khusus Admin!',
	botAdmin: 'Bot Bukan Admin!',
	group: 'Gunakan Di Group!',
	private: 'Gunakan Di Privat Chat!',
	limit: 'Limit Anda Telah Habis!',
	prem: 'Khusus User Premium!',
	wait: 'Loading...',
	error: 'Error!',
	done: 'Done'
}

global.APIs = {
	hitori: 'https://api.hitori.pw',
}
global.APIKeys = {
	'https://api.hitori.pw': 'htrkey-77eb83c0eeb39d40',
	geminiApikey: ['AIzaSyDG7ACSLa69OLP7zmTidAEYJ04WS3WRt74'],
}

// Lainnya

global.badWords = ['tolol','goblok','asu','pantek','kampret','ngentot','jancok','kontol','memek','lonte','jembut']
global.chatLength = 99999

//~~~~~~~~~~~~~~~< PROCESS >~~~~~~~~~~~~~~~\\

let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(chalk.redBright(`Update ${__filename}`))
	delete require.cache[file]
	require(file)
});
