require('../settings');
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const chalk = require('chalk');
const crypto = require('crypto');
const FileType = require('file-type');
const PhoneNumber = require('awesome-phonenumber');
const { sendInteractiveMessage } = require('@ryuu-reinzz/button-helper');

const { checkStatus } = require('./database');
const { imageToWebp, videoToWebp, writeExif, gifToWebp } = require('../lib/exif');
const { isUrl, getGroupAdmins, generateMessageTag, getBuffer, getSizeMedia, fetchJson, sleep, getTypeUrlMedia } = require('../lib/function');
const { jidNormalizedUser, proto, getBinaryNodeChildren, getBinaryNodeChildString, getBinaryNodeChild, generateMessageIDV2, jidEncode, encodeSignedDeviceIdentity, generateWAMessageContent, generateForwardMessageContent, prepareWAMessageMedia, delay, areJidsSameUser, extractMessageContent, generateMessageID, downloadContentFromMessage, generateWAMessageFromContent, jidDecode, generateWAMessage, toBuffer, getContentType, WAMessageStubType, getDevice } = require('baileys');

/*
	* Create By INV_TECH
	* Follow https://github.com/Izharelop
    * Fixed by Gemini for Interactive Message Support
*/

async function GroupUpdate(zhar, m, store) {
	if (!m.messageStubType || !m.isGroup) return
	if (global.db?.groups?.[m.chat] && store?.groupMetadata?.[m.chat] && zhar.public) {
		const admin = `@${m.sender.split('@')[0]}`
		const metadata = store.groupMetadata[m.chat];
		const normalizedTarget = m.messageStubParameters[0]
		const messages = {
			1: 'mereset link grup!',
			21: `mengubah Subject Grup menjadi :\n*${normalizedTarget}*`,
			22: 'telah mengubah icon grup.',
			23: 'mereset link grup!',
			24: `mengubah deskripsi grup.\n\n${normalizedTarget}`,
			25: `telah mengatur agar *${normalizedTarget == 'on' ? 'hanya admin' : 'semua peserta'}* yang dapat mengedit info grup.`,
			26: `telah *${normalizedTarget == 'on' ? 'menutup' : 'membuka'}* grup!\nSekarang ${normalizedTarget == 'on' ? 'hanya admin yang' : 'semua peserta'} dapat mengirim pesan.`,
			29: `telah menjadikan @${normalizedTarget?.split('@')?.[0]} sebagai admin.`,
			30: `telah memberhentikan @${normalizedTarget?.split('@')?.[0]} dari admin.`,
			72: `mengubah durasi pesan sementara menjadi *@${normalizedTarget}*`,
			123: 'menonaktifkan pesan sementara.',
			132: 'mereset link grup!',
		}
		if (global.db?.groups?.[m.chat]?.setinfo && messages[m.messageStubType]) {
			await zhar.sendMessage(m.chat, { text: `${admin} ${messages[m.messageStubType]}`, mentions: [m.sender, ...(normalizedTarget?.includes('@') ? [`${normalizedTarget}`] : [])]}, { ephemeralExpiration: m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
		} else if (m.messageStubType == 20) {
			store.groupMetadata[m.chat] = await zhar.groupMetadata(m.chat).catch(e => ({}));
		} else if (m.messageStubType == 27) {
			if (!metadata.participants.some(a => a.id == normalizedTarget)) metadata.participants.push({ ...(metadata.addressingMode === 'lid' ? { id: '', lid: normalizedTarget } : { id: normalizedTarget, lid: '' }), admin: null });
		} else if (m.messageStubType == 28 || m.messageStubType == 32) {
			if (m.fromMe && ((jidNormalizedUser(zhar.user.id) == normalizedTarget) || (jidNormalizedUser(zhar.user.lid) == normalizedTarget))) {
				delete store.messages[m.chat];
				delete store.presences[m.chat];
				delete store.groupMetadata[m.chat];
			}
			if(!!metadata) metadata.participants = metadata.participants.filter(p => {
				const key = metadata.addressingMode === 'lid' ? jidNormalizedUser(p.lid) : jidNormalizedUser(p.id)
				return key !== normalizedTarget
			});
		}
	}
}

async function GroupParticipantsUpdate(zhar, { id, participants, author, action }, store) {
	try {
		function updateAdminStatus(participants, metadataParticipants, status) {
			for (const participant of metadataParticipants) {
				if (participants.includes(jidNormalizedUser(participant.id)) || participants.includes(jidNormalizedUser(participant.lid))) {
					participant.admin = status;
				}
			}
		}
		if (global.db?.groups?.[id] && store?.groupMetadata?.[id]) {
			const metadata = store.groupMetadata[id];
			for (let n of participants) {
				const participant = metadata.participants.find(a => a.id == jidNormalizedUser(n))
				let profile;
				try {
					profile = await zhar.profilePictureUrl(n, 'image');
				} catch {
					profile = 'https://telegra.ph/file/95670d63378f7f4210f03.png';
				}
				let messageText;
				if (action === 'add') {
					if (db.groups[id].welcome) messageText = db.groups[id]?.text?.setwelcome || `Welcome to ${metadata.subject}\n@`;
					if (!participant) metadata.participants.push({ ...(metadata.addressingMode === 'lid' ? { id: '', lid: jidNormalizedUser(n) } : { id: jidNormalizedUser(n), lid: '' }), admin: null });
				} else if (action === 'remove') {
					if (db.groups[id].leave) messageText = db.groups[id]?.text?.setleave || `@\nLeaving From ${metadata.subject}`;
					if ((jidNormalizedUser(zhar.user.lid) == jidNormalizedUser(n)) || (jidNormalizedUser(zhar.user.id) == jidNormalizedUser(n))) {
						delete store.messages[id];
						delete store.presences[id];
						delete store.groupMetadata[id];
					}
					if(metadata) metadata.participants = metadata.participants.filter(p => !participants.includes(metadata.addressingMode === 'lid' ? jidNormalizedUser(p.lid) : jidNormalizedUser(p.id)));
				} else if (action === 'promote') {
					if (db.groups[id].promote) messageText = db.groups[id]?.text?.setpromote || `@\nPromote From ${metadata.subject}\nBy @admin`;
					updateAdminStatus(participants, metadata.participants, 'admin');
				} else if (action === 'demote') {
					if (db.groups[id].demote) messageText = db.groups[id]?.text?.setdemote || `@\nDemote From ${metadata.subject}\nBy @admin`;
					updateAdminStatus(participants, metadata.participants, null);
				}
				if (messageText && zhar.public) {
					await zhar.sendMessage(id, {
						text: messageText.replace('@subject', author ? `${metadata.subject}` : '@subject').replace('@admin', author ? `@${author.split('@')[0]}` : '@admin').replace(/(?<=\s|^)@(?!\w)/g, `@${n.split('@')[0]}`),
						contextInfo: {
							mentionedJid: [n, author],
							externalAdReply: {
								title: action == 'add' ? 'Welcome' : action == 'remove' ? 'Leaving' : action.charAt(0).toUpperCase() + action.slice(1),
								mediaType: 1,
								previewType: 0,
								thumbnailUrl: profile,
								renderLargerThumbnail: true,
								sourceUrl: global.my.gh
							}
						}
					}, { ephemeralExpiration: metadata?.ephemeralDuration || store?.messages[id]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
				}
			}
		}
	} catch (e) {
		throw e;
	}
}

async function LoadDataBase(zhar, m) {
	try {
		const botNumber = await zhar.decodeJid(zhar.user.id);
		let game = global.db.game || {};
		let premium = global.db.premium || [];
		let user = global.db.users[m.sender] || {};
		let setBot = global.db.set[botNumber] || {};
		
		global.db.database = global.db.database || {};  // milik addmsg
		global.db.game = game;
		global.db.users[m.sender] = user;
		global.db.set[botNumber] = setBot;
		
		const defaultSetBot = {
			lang: 'id',
			limit: 0,
			money: 0,
			status: 0,
			join: false,
			public: true,
			anticall: true,
			original: true,
			readsw: false,
			autobio: false,
			autoread: true,
			antispam: false,
			autotyping: true,
			grouponly: true,
			multiprefix: false,
			privateonly: true,
			author: global.author || 'izhar',
			autobackup: false,
			botname: global.botname || 'dev bot',
			packname: global.packname || 'Bot WhatsApp',
			template: 'documentMessage',
			owner: global.owner.map(id => ({ id, lock: true })),
		};
		for (let key in defaultSetBot) {
			if (!(key in setBot)) setBot[key] = defaultSetBot[key];
		}
		
		const limitUser = user.vip ? global.limit.vip : checkStatus(m.sender, premium) ? global.limit.premium : global.limit.free;
		const moneyUser = user.vip ? global.money.vip : checkStatus(m.sender, premium) ? global.money.premium : global.money.free;
		
		const defaultUser = {
			vip: false,
			ban: false,
			afkTime: -1,
			afkReason: '',
			register: false,
			limit: limitUser,
			money: moneyUser,
			lastclaim: Date.now(),
			lastbegal: Date.now(),
			lastrampok: Date.now(),
		};
		for (let key in defaultUser) {
			if (!(key in user)) user[key] = defaultUser[key];
		}
		
		if (m.isGroup) {
			let group = global.db.groups[m.chat] || {};
			global.db.groups[m.chat] = group;
			
			const defaultGroup = {
				url: '',
				text: {},
				warn: {},
				tagsw: {},
				nsfw: false,
				mute: false,
				leave: false,
				setinfo: false,
				antilink: false,
				demote: false,
				antitoxic: false,
				promote: false,
				welcome: false,
				antivirtex: false,
				antitagsw: false,
				antidelete: false,
				antihidetag: false,
				waktusholat: false,
			};
			for (let key in defaultGroup) {
				if (!(key in group)) group[key] = defaultGroup[key];
			}
		}
		
		const defaultGame = {
			suit: {},
			chess: {},
			chat_ai: {},
			menfes: {},
			tekateki: {},
			akinator: {},
			tictactoe: {},
			tebaklirik: {},
			kuismath: {},
			blackjack: {},
			tebaklagu: {},
			tebakkata: {},
			family100: {},
			susunkata: {},
			tebakbom: {},
			ulartangga: {},
			tebakkimia: {},
			caklontong: {},
			tebakangka: {},
			tebaknegara: {},
			tebakgambar: {},
			tebakbendera: {},
		};
		for (let key in defaultGame) {
			if (!(key in game)) game[key] = defaultGame[key];
		}
		
	} catch (e) {
		throw e
	}
}

async function MessagesUpsert(zhar, message, store) {
	try {
		let botNumber = await zhar.decodeJid(zhar.user.id);
		const msg = message.messages[0];
		const remoteJid = msg.key.remoteJid;
		store.messages[remoteJid] ??= {};
		store.messages[remoteJid].array ??= [];
		store.messages[remoteJid].keyId ??= new Set();
		if (!(store.messages[remoteJid].keyId instanceof Set)) {
			store.messages[remoteJid].keyId = new Set(store.messages[remoteJid].array.map(m => m.key.id));
		}
		if (store.messages[remoteJid].keyId.has(msg.key.id)) return;
		store.messages[remoteJid].array.push(msg);
		store.messages[remoteJid].keyId.add(msg.key.id);
		if (store.messages[remoteJid].array.length > (global.chatLength || 250)) {
			const removed = store.messages[remoteJid].array.shift();
			store.messages[remoteJid].keyId.delete(removed.key.id);
		}
		if (!store.groupMetadata || Object.keys(store.groupMetadata).length === 0) store.groupMetadata ??= await zhar.groupFetchAllParticipating().catch(e => ({}));
		const type = msg.message ? (getContentType(msg.message) || Object.keys(msg.message)[0]) : '';
		const m = await Serialize(zhar, msg, store)
		require('../zhar')(zhar, m, msg, store);
		if (db?.set?.[botNumber]?.readsw && msg.key.remoteJid === 'status@broadcast') {
			await zhar.readMessages([msg.key]);
			if (/protocolMessage/i.test(type)) await zhar.sendFromOwner(global.db?.set?.[botNumber]?.owner?.map(x => x.id) || global.owner, 'Status dari @' + msg.key.participant.split('@')[0] + ' Telah dihapus', msg, { mentions: [msg.key.participant] });
			if (/(audioMessage|imageMessage|videoMessage|extendedTextMessage)/i.test(type)) {
				let keke = (type == 'extendedTextMessage') ? `Story Teks Berisi : ${msg.message.extendedTextMessage.text ? msg.message.extendedTextMessage.text : ''}` : (type == 'imageMessage') ? `Story Gambar ${msg.message.imageMessage.caption ? 'dengan Caption : ' + msg.message.imageMessage.caption : ''}` : (type == 'videoMessage') ? `Story Video ${msg.message.videoMessage.caption ? 'dengan Caption : ' + msg.message.videoMessage.caption : ''}` : (type == 'audioMessage') ? 'Story Audio' : '\nTidak diketahui cek saja langsung'
				await zhar.sendFromOwner(global.db?.set?.[botNumber]?.owner?.map(x => x.id) || global.sw, `Melihat story dari @${msg.key.participant.split('@')[0]}\n${keke}`, msg, { mentions: [msg.key.participant] });
			}
		}
	} catch (e) {
		throw e;
	}
}

async function Solving(zhar, store) {
	// --- RESOLVING LID DAN JID ---
	zhar.findJidByLid = (lid) => {
        if (!lid || !store.contacts) return null;
        for (const contact of Object.values(store.contacts)) {
            if (contact.lid === lid) return contact.id;
        }
        return null;
    }

    zhar.resolveLid = async (jid) => {
        if (jid.endsWith('@lid')) return jid.split('@')[0];
        if (jid.endsWith('@s.whatsapp.net')) {
            const resolved = await zhar.signalRepository.lidMapping.getLIDForPN(jid);
            if (resolved) {
                return typeof resolved === "string" && resolved.endsWith("@lid")
                    ? resolved.split("@")[0]
                    : resolved;
            }
        }
        return jid.split('@')[0];
    }

    // --- MANAJEMEN METADATA GRUP TEROPTIMASI (Cache System) ---
    if (!global.groupMetaCache) global.groupMetaCache = new Map();

    zhar.getGroupMetadataOptimized = async (jid) => {
        const now = Date.now();
        const cacheTTL = 10 * 60 * 1000; 

        if (global.groupMetaCache.has(jid)) {
            const cached = global.groupMetaCache.get(jid);
            if (now - cached.timestamp < cacheTTL) {
                return cached.data;
            }
        }

        try {
            const metadata = await zhar.groupMetadata(jid);
            global.groupMetaCache.set(jid, {
                data: metadata,
                timestamp: now
            });
            if (store.groupMetadata) store.groupMetadata[jid] = metadata;
            return metadata;
        } catch (e) {
            return store.groupMetadata?.[jid] || {};
        }
    }
	
	zhar.serializeM = (m) => MessagesUpsert(zhar, m, store)
	
	zhar.decodeJid = (jid) => {
		if (!jid) return jid
		if (/:\d+@/gi.test(jid)) {
			let decode = jidDecode(jid) || {}
			return decode.user && decode.server && decode.user + '@' + decode.server || jid
		} else return jid
	}
	
	zhar.findJidByLid = (lid, store) => {
		for (const contact of Object.values(store.contacts)) {
			if (contact.lid === lid) {
				return contact.id;
			}
		}
		return null;
	}
	
	zhar.getName = (jid, withoutContact  = false) => {
		const id = zhar.decodeJid(jid);
		if (id.endsWith('@g.us')) {
			const groupInfo = store.contacts[id] || (store.groupMetadata[id] ? store.groupMetadata[id] : (store.groupMetadata[id] = zhar.groupMetadata(id))) || {};
			return Promise.resolve(groupInfo.name || groupInfo.subject || PhoneNumber('+' + id.replace('@g.us', '')).getNumber('international'));
		} else {
			if (id === '0@s.whatsapp.net') {
				return 'WhatsApp';
			}
		const contactInfo = store.contacts[id] || {};
		return withoutContact ? '' : contactInfo.name || contactInfo.subject || contactInfo.verifiedName || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international');
		}
	}
	
	zhar.sendContact = async (jid, kon, quoted = '', opts = {}) => {
		let list = []
		for (let i of kon) {
			list.push({
				displayName: await zhar.getName(i + '@s.whatsapp.net'),
				vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await zhar.getName(i + '@s.whatsapp.net')}\nFN:${await zhar.getName(i + '@s.whatsapp.net')}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Ponsel\nitem2.ADR:;;Indonesia;;;;\nitem2.X-ABLabel:Region\nEND:VCARD`
			})
		}
		zhar.sendMessage(jid, { contacts: { displayName: `${list.length} Kontak`, contacts: list }, ...opts }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
	}
	
	zhar.profilePictureUrl = async (jid, type = 'image', timeoutMs) => {
		const result = await zhar.query({
			tag: 'iq',
			attrs: {
				target: jidNormalizedUser(jid),
				to: '@s.whatsapp.net',
				type: 'get',
				xmlns: 'w:profile:picture'
			},
			content: [{
				tag: 'picture',
				attrs: {
					type, query: 'url'
				},
			}]
		}, timeoutMs);
		const child = getBinaryNodeChild(result, 'picture');
		return child?.attrs?.url;
	}
	
	zhar.setStatus = (status) => {
		zhar.query({
			tag: 'iq',
			attrs: {
				to: '@s.whatsapp.net',
				type: 'set',
				xmlns: 'status',
			},
			content: [{
				tag: 'status',
				attrs: {},
				content: Buffer.from(status, 'utf-8')
			}]
		})
		return status
	}
	
	zhar.extractGroupMetadata = (result) => {
		const group = getBinaryNodeChild(result, 'group');
		const descChild = getBinaryNodeChild(group, 'description');
		const desc = descChild ? getBinaryNodeChildString(descChild, 'body') : undefined;
		const descId = descChild?.attrs?.id;
		const groupId = group.attrs.id.includes('@') ? group.attrs.id : jidEncode(group.attrs.id, 'g.us');
		const eph = getBinaryNodeChild(group, 'ephemeral')?.attrs?.expiration;
		const participants = getBinaryNodeChildren(group, 'participant') || [];
		return {
			id: groupId,
			addressingMode: group.attrs.addressing_mode,
			subject: group.attrs.subject,
			subjectOwner: group.attrs.s_o,
			subjectTime: +group.attrs.s_t,
			creation: +group.attrs.creation,
			size: participants.length,
			owner: group.attrs.creator ? jidNormalizedUser(group.attrs.creator) : undefined,
			desc,
			descId,
			linkedParent: getBinaryNodeChild(group, 'linked_parent')?.attrs?.jid,
			restrict: !!getBinaryNodeChild(group, 'locked'),
			announce: !!getBinaryNodeChild(group, 'announcement'),
			isCommunity: !!getBinaryNodeChild(group, 'parent'),
			isCommunityAnnounce: !!getBinaryNodeChild(group, 'default_sub_group'),
			joinApprovalMode: !!getBinaryNodeChild(group, 'membership_approval_mode'),
			memberAddMode: getBinaryNodeChildString(group, 'member_add_mode') === 'all_member_add',
			ephemeralDuration: eph ? +eph : undefined,
			participants: participants.map(({ attrs }) => ({
				id: attrs.jid.endsWith('@lid') ? attrs.phone_number : attrs.jid,
				lid: attrs.jid.endsWith('@lid') ? attrs.jid : attrs.lid,
				admin: attrs.type || null
			}))
		};
	}
	
	zhar.groupMetadata = async (jid) => {
		const result = await zhar.query({
			tag: 'iq',
			attrs: {
				type: 'get',
				xmlns: 'w:g2',
				to: jid
			},
			content: [{ tag: 'query', attrs: { request: 'interactive' }}]
		});
		return zhar.extractGroupMetadata(result);
	};
	
	zhar.groupFetchAllParticipating = async () => {
		const result = await zhar.query({ tag: 'iq', attrs: { to: '@g.us', xmlns: 'w:g2', type: 'get' }, content: [{ tag: 'participating', attrs: {}, content: [{ tag: 'participants', attrs: {}}, { tag: 'description', attrs: {}}]}]});
		const data = {};
		const groupsChild = getBinaryNodeChild(result, 'groups');
		if (groupsChild) {
			const groups = getBinaryNodeChildren(groupsChild, 'group');
			for (const groupNode of groups) {
				const meta = zhar.extractGroupMetadata({
					tag: 'result',
					attrs: {},
					content: [groupNode]
				});
				data[meta.id] = meta;
			}
		}
		zhar.ev.emit('groups.update', Object.values(data));
		return data;
	}

	zhar.sendPoll = (jid, name = '', values = [], quoted, selectableCount = 1) => {
		return zhar.sendMessage(jid, { poll: { name, values, selectableCount }}, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
	}
	
	zhar.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
		const quotedOptions = { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 }
		async function getFileUrl(res, mime) {
			if (mime && mime.includes('gif')) {
				return zhar.sendMessage(jid, { video: res.data, caption: caption, gifPlayback: true, ...options }, quotedOptions);
			} else if (mime && mime === 'application/pdf') {
				return zhar.sendMessage(jid, { document: res.data, mimetype: 'application/pdf', caption: caption, ...options }, quotedOptions);
			} else if (mime && mime.includes('image')) {
				return zhar.sendMessage(jid, { image: res.data, caption: caption, ...options }, quotedOptions);
			} else if (mime && mime.includes('video')) {
				return zhar.sendMessage(jid, { video: res.data, caption: caption, mimetype: 'video/mp4', ...options }, quotedOptions);
			} else if (mime && mime.includes('webp') && !/.jpg|.jpeg|.png/.test(url)) {
				return zhar.sendAsSticker(jid, res.data, quoted, options);
			} else if (mime && mime.includes('audio')) {
				return zhar.sendMessage(jid, { audio: res.data, mimetype: 'audio/mpeg', ...options }, quotedOptions);
			}
		}
		const axioss = axios.create({
			httpsAgent: new https.Agent({ rejectUnauthorized: false }),
		});
		const res = await axioss.get(url, { responseType: 'arraybuffer' });
		let mime = res.headers['content-type'];
		if (!mime || mime.includes('octet-stream')) {
			const fileType = await FileType.fromBuffer(res.data);
			mime = fileType ? fileType.mime : null;
		}
		const hasil = await getFileUrl(res, mime);
		return hasil
	}
	
	zhar.sendGroupInvite = async (jid, participant, inviteCode, inviteExpiration, groupName = 'Unknown Subject', caption = 'Invitation to join my WhatsApp group', jpegThumbnail = null, options = {}) => {
		const msg = proto.Message.fromObject({
			groupInviteMessage: {
				inviteCode,
				inviteExpiration: parseInt(inviteExpiration) || + new Date(new Date + (3 * 86400000)),
				groupJid: jid,
				groupName,
				jpegThumbnail: Buffer.isBuffer(jpegThumbnail) ? jpegThumbnail : null,
				caption,
				contextInfo: {
					mentionedJid: options.mentions || []
				}
			}
		});
		const message = generateWAMessageFromContent(participant, msg, options);
		const invite = await zhar.relayMessage(participant, message.message, { messageId: message.key.id })
		return invite
	}
	
    // --- FIX TypeError: jid is not iterable ---
	zhar.sendFromOwner = async (jid, text, quoted, options = {}) => {
        const targets = Array.isArray(jid) ? jid : [jid]; // Pastikan jid berbentuk Array
		for (const a of targets) {
            if (!a) continue; // Skip jika undefined
			await zhar.sendMessage(a.replace(/[^0-9]/g, '') + '@s.whatsapp.net', { text, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
		}
	}
	
	zhar.sendText = async (jid, text, quoted, options = {}) => zhar.sendMessage(jid, { text: text, mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net'), ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
    
    // --- FIX & IMPLEMENTASI INTERAKTIF MESSAGE (BUTTON/LIST) ---
	
    zhar.sendButtonMsg = async (jid, content = {}, options = {}) => {
		const payload = {
            // Mapping properti agar sesuai dengan kebutuhan helper
            // 'text' adalah wajib, jadi kita ambil dari beberapa kemungkinan
			text: content.text || content.caption || content.body || ' ',
			footer: content.footer || '',
			title: content.title || content.header || '',
			subtitle: content.subtitle || '',
			...content, 
			interactiveButtons: content.buttons || []
		};
		return await sendInteractiveMessage(zhar, jid, payload, options);
	}

    // Untuk List Message, kita juga gunakan helper yang sama karena dia bisa handle single_select
    zhar.sendListMsg = async (jid, content = {}, options = {}) => {
        return zhar.sendButtonMsg(jid, content, options);
    }

    // --- SW GC V2 ---
    zhar.sendGroupStatus = async (jid, content, options = {}) => {
        const { generateWAMessageContent, generateWAMessageFromContent } = require('baileys');
        let media = await generateWAMessageContent(content, { upload: zhar.waUploadToServer });
        const messageSecret = require('crypto').randomBytes(32);
        const msg = await generateWAMessageFromContent(jid, {
            messageContextInfo: { messageSecret: messageSecret },
            groupStatusMessageV2: {
                message: { ...media, messageContextInfo: { messageSecret: messageSecret } }
            }
        }, options);
        await zhar.relayMessage(jid, msg.message, { messageId: msg.key.id });
        return msg;
    }
	
	zhar.sendAsSticker = async (jid, path, quoted, options = {}) => {
		const buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
		const result = await writeExif(buff, options);
		return zhar.sendMessage(jid, { sticker: { url: result }, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
	}
	
	zhar.downloadMediaMessage = async (message) => {
		const msg = message.msg || message;
		const mime = msg.mimetype || '';
		const messageType = (message.type || mime.split('/')[0]).replace(/Message/gi, '');
		const stream = await downloadContentFromMessage(msg, messageType);
		let buffer = Buffer.from([]);
		for await (const chunk of stream) {
			buffer = Buffer.concat([buffer, chunk]);
		}
		return buffer
	}
	
	zhar.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
		const buffer = await zhar.downloadMediaMessage(message);
		const type = await FileType.fromBuffer(buffer);
		const trueFileName = attachExtension ? `./database/sampah/${filename ? filename : Date.now()}.${type.ext}` : filename;
		await fs.promises.writeFile(trueFileName, buffer);
		return trueFileName;
	}
	
	zhar.getFile = async (PATH, save) => {
		let res;
		let filename;
		let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
		let type = await FileType.fromBuffer(data) || { mime: 'application/octet-stream', ext: '.bin' }
		filename = path.join(__dirname, '../database/sampah/' + new Date * 1 + '.' + type.ext)
		if (data && save) fs.promises.writeFile(filename, data)
		return {
			res,
			filename,
			size: await getSizeMedia(data),
			...type,
			data
		}
	}
	
	zhar.appendResponseMessage = async (m, text) => {
		let apb = await generateWAMessage(m.chat, { text, mentions: m.mentionedJid }, { userJid: zhar.user.id, quoted: m.quoted && m.quoted.fakeObj, ephemeralExpiration: m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
		apb.key = m.key
		apb.key.id = [...Array(32)].map(() => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
		apb.key.fromMe = areJidsSameUser(m.sender, zhar.user.id);
		if (m.isGroup) apb.participant = m.sender;
		zhar.ev.emit('messages.upsert', {
			...m,
			messages: [proto.WebMessageInfo.fromObject(apb)],
			type: 'append'
		});
	}
	
	zhar.sendMedia = async (jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
		const { mime, data, filename } = await zhar.getFile(path, true);
		const botNumber = zhar.decodeJid(zhar.user.id);
		const isWebpSticker = options.asSticker || /webp/.test(mime);
		let type = 'document', mimetype = mime, pathFile = filename;
		if (isWebpSticker) {
			pathFile = await writeExif(data, {
				packname: options.packname || db?.set?.[botNumber]?.packname || 'Bot WhatsApp',
				author: options.author || db?.set?.[botNumber]?.author || 'zhar',
				categories: options.categories || [],
			})
			await fs.unlinkSync(filename);
			type = 'sticker';
			mimetype = 'image/webp';
		} else if (/image|video|audio/.test(mime)) {
			type = mime.split('/')[0];
			mimetype = type == 'video' ? 'video/mp4' : type == 'audio' ? 'audio/mpeg' : mime
		}
		let anu = await zhar.sendMessage(jid, { [type]: { url: pathFile }, caption, mimetype, fileName, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || quoted?.metadata?.ephemeralDuration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0, ...options });
		await fs.unlinkSync(pathFile);
		return anu;
	}
	
	zhar.sendAlbumMessage = async (jid, content = {}, options = {}) => {
		const { album, mentions, contextInfo, ...others } = content;
		for (const media of album) {
			if (!media.image && !media.video) throw new TypeError(`album[i] must have image or video property`);
		}
		if (album.length < 2) throw new RangeError("Minimum 2 media");
		const medias = await generateWAMessageFromContent(jid, {
			albumMessage: {
				expectedImageCount: album.filter(m => m.image).length,
				expectedVideoCount: album.filter(m => m.video).length,
			}
		}, {});
		await zhar.relayMessage(jid, medias.message, { messageId: medias.key.id });
		for (const media of album) {
			const msg = await generateWAMessage(jid, { ...others, ...media }, { upload: zhar.waUploadToServer });
			msg.message.messageContextInfo = {
				messageAssociation: {
					associationType: 1,
					parentMessageKey: medias.key
				}
			}
			await zhar.relayMessage(jid, msg.message, { messageId: msg.key.id });
		}
		return medias;
	}
	
    // Carousel tetap manual karena formatnya spesifik dan jarang bermasalah jika struktur card benar
	zhar.sendCarouselMsg = async (jid, body = '', footer = '', cards = [], options = {}) => {
		async function getImageMsg(url) {
			const { imageMessage } = await generateWAMessageContent({ image: { url } }, { upload: zhar.waUploadToServer });
			return imageMessage;
		}
		const cardPromises = cards.map(async (a) => {
			const imageMessage = await getImageMsg(a.header.imageMessage.imageMessage.url || a.header.imageMessage.url);
			return {
				header: {
					imageMessage: imageMessage,
					hasMediaAttachment: true
				},
				body: { text: a.body.text },
				footer: { text: a.footer.text },
				nativeFlowMessage: {
					buttons: a.nativeFlowMessage.buttons.map(b => ({
						name: b.name,
						buttonParamsJson: b.buttonParamsJson
					}))
				}
			};
		});
		
		const cardResults = await Promise.all(cardPromises);
		const msg = await generateWAMessageFromContent(jid, {
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2
					},
					interactiveMessage: proto.Message.InteractiveMessage.create({
						body: proto.Message.InteractiveMessage.Body.create({ text: body }),
						footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
						carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
							cards: cardResults,
							messageVersion: 1
						})
					})
				}
			}
		}, options);
		const hasil = await zhar.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id });
		return hasil
	}
	
	if (zhar.user && zhar.user.id) {
		const botNumber = zhar.decodeJid(zhar.user.id);
		if (global.db?.set[botNumber]) {
			zhar.public = global.db.set[botNumber].public
		} else zhar.public = true
	} else zhar.public = true

	return zhar
}

async function Serialize(zhar, msg, store) {
	const botLid = zhar.decodeJid(zhar.user.lid);
	const botNumber = zhar.decodeJid(zhar.user.id);
	const m = { ...msg };
	if (!m) return m
	if (m.key) {
		m.id = m.key.id
		m.chat = m.key.remoteJid
		m.fromMe = m.key.fromMe
		m.isBot = ['HSK', 'BAE', 'B1E', '3EB0', 'B24E', 'WA'].some(a => m.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.id.length)) || /(.)\1{5,}|[^a-zA-Z0-9]|[^0-9A-F]/.test(m.id) || false
		m.isGroup = m.chat.endsWith('@g.us')
		if (!m.isGroup && m.chat.endsWith('@lid')) m.chat = zhar.findJidByLid(m.chat, store) || m.chat;
		m.sender = zhar.decodeJid(m.fromMe && zhar.user.id || m.key.participant || m.chat || '')
		if (m.isGroup) {
            let metadata = await zhar.getGroupMetadataOptimized(m.chat);
            m.metadata = metadata;
            m.metadata.size = (metadata.participants || []).length;

            if (metadata.addressingMode === 'lid') {
                const participant = metadata.participants.find(a => a.lid === m.sender);
                m.key.participant = m.sender = participant?.id || m.sender;
                
                if (store.contacts) {
                    store.contacts[m.sender] = { 
                        ...store.contacts[m.sender], 
                        id: m.sender, 
                        lid: participant?.lid || m.sender, 
                        name: m.pushName 
                    };
                }
            }
            
            m.admins = m.metadata.participants ? (m.metadata.participants.reduce((a, b) => (b.admin ? a.push({ id: b.id, admin: b.admin }) : [...a]) && a, [])) : [];
            m.isAdmin = m.admins?.some((b) => b.id === m.sender) || false;
            m.isBotAdmin = !!m.admins?.find((member) => [botNumber, botLid].includes(member.id)) || false;
        }
	}
	if (m.message) {
		m.type = getContentType(m.message) || Object.keys(m.message)[0]
		m.msg = (/viewOnceMessage|viewOnceMessageV2Extension|editedMessage|ephemeralMessage/i.test(m.type) ? m.message[m.type].message[getContentType(m.message[m.type].message)] : (extractMessageContent(m.message[m.type]) || m.message[m.type]))
		m.body = m.message?.conversation || m.msg?.text || m.msg?.conversation || m.msg?.caption || m.msg?.selectedButtonId || m.msg?.singleSelectReply?.selectedRowId || m.msg?.selectedId || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || m.msg?.name || ''
		m.mentionedJid = m.msg?.contextInfo?.mentionedJid || []
		m.text = m.msg?.text || m.msg?.caption || m.message?.conversation || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || '';
		m.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(m.body) ? m.body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : /[\uD800-\uDBFF][\uDC00-\uDFFF]/gi.test(m.body) ? m.body.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/gi)[0] : ''
		m.command = m.body && m.body.replace(m.prefix, '').trim().split(/ +/).shift()
		m.args = m.body?.trim().replace(new RegExp("^" + m.prefix?.replace(/[.*=+:\-?^${}()|[\]\\]|\s/g, '\\$&'), 'i'), '').replace(m.command, '').split(/ +/).filter(a => a) || []
		m.device = getDevice(m.id)
		m.expiration = m.msg?.contextInfo?.expiration || m?.metadata?.ephemeralDuration || store?.messages?.[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0
		m.timestamp = (typeof m.messageTimestamp === "number" ? m.messageTimestamp : m.messageTimestamp.low ? m.messageTimestamp.low : m.messageTimestamp.high) || m.msg.timestampMs * 1000
		m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath
		if (m.isMedia) {
			m.mime = m.msg?.mimetype
			m.size = m.msg?.fileLength
			m.height = m.msg?.height || ''
			m.width = m.msg?.width || ''
			if (/webp/i.test(m.mime)) {
				m.isAnimated = m.msg?.isAnimated
			}
		}
		m.quoted = m.msg?.contextInfo?.quotedMessage || null
		if (m.quoted) {
			m.quoted.message = extractMessageContent(m.msg?.contextInfo?.quotedMessage)
			m.quoted.type = getContentType(m.quoted.message) || Object.keys(m.quoted.message)[0]
			m.quoted.id = m.msg.contextInfo.stanzaId
			m.quoted.device = getDevice(m.quoted.id)
			m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat
			m.quoted.isBot = m.quoted.id ? ['HSK', 'BAE', 'B1E', '3EB0', 'B24E', 'WA'].some(a => m.quoted.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.quoted.id.length)) || /(.)\1{5,}|[^a-zA-Z0-9]|[^0-9A-F]/.test(m.quoted.id) : false
			if (m.msg?.contextInfo?.participant?.endsWith('@lid')) m.msg.contextInfo.participant =  m?.metadata?.participants?.find(a => a.lid === m.msg.contextInfo.participant)?.id || m.msg.contextInfo.participant;
			m.quoted.sender = zhar.decodeJid(m.msg.contextInfo.participant)
			m.quoted.fromMe = m.quoted.sender === zhar.decodeJid(zhar.user.id)
			m.quoted.text = m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || ''
			m.quoted.msg = extractMessageContent(m.quoted.message[m.quoted.type]) || m.quoted.message[m.quoted.type]
			m.quoted.mentionedJid = m.quoted?.msg?.contextInfo?.mentionedJid || []
			m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || ''
			m.getQuotedObj = async () => {
				if (!m.quoted.id) return false
				let q = await store.loadMessage(m.chat, m.quoted.id, zhar)
				return await Serialize(zhar, q, store)
			}
			m.quoted.key = {
				remoteJid: m.msg?.contextInfo?.remoteJid || m.chat,
				participant: m.quoted.sender,
				fromMe: areJidsSameUser(zhar.decodeJid(m.msg?.contextInfo?.participant), zhar.decodeJid(zhar?.user?.id)),
				id: m.msg?.contextInfo?.stanzaId
			}
			m.quoted.isGroup = m.quoted.chat.endsWith('@g.us')
			m.quoted.mentions = m.quoted.msg?.contextInfo?.mentionedJid || []
			m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || ''
			m.quoted.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(m.quoted.body) ? m.quoted.body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : /[\uD800-\uDBFF][\uDC00-\uDFFF]/gi.test(m.quoted.body) ? m.quoted.body.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/gi)[0] : ''
			m.quoted.command = m.quoted.body && m.quoted.body.replace(m.quoted.prefix, '').trim().split(/ +/).shift()
			m.quoted.isMedia = !!m.quoted.msg?.mimetype || !!m.quoted.msg?.thumbnailDirectPath
			if (m.quoted.isMedia) {
				m.quoted.fileSha256 = m.quoted[m.quoted.type]?.fileSha256 || ''
				m.quoted.mime = m.quoted.msg?.mimetype
				m.quoted.size = m.quoted.msg?.fileLength
				m.quoted.height = m.quoted.msg?.height || ''
				m.quoted.width = m.quoted.msg?.width || ''
				if (/webp/i.test(m.quoted.mime)) {
					m.quoted.isAnimated = m?.quoted?.msg?.isAnimated || false
				}
			}
			m.quoted.fakeObj = proto.WebMessageInfo.fromObject({
				key: {
					remoteJid: m.quoted.chat,
					fromMe: m.quoted.fromMe,
					id: m.quoted.id
				},
				message: m.quoted,
				...(m.isGroup ? { participant: m.quoted.sender } : {})
			})
			m.quoted.download = () => zhar.downloadMediaMessage(m.quoted)
			m.quoted.delete = () => {
				zhar.sendMessage(m.quoted.chat, {
					delete: {
						remoteJid: m.quoted.chat,
						fromMe: m.isBotAdmins ? false : true,
						id: m.quoted.id,
						participant: m.quoted.sender
					}
				})
			}
		}
	}
	
	m.download = () => zhar.downloadMediaMessage(m)
	
	m.copy = () => Serialize(zhar, proto.WebMessageInfo.fromObject(proto.WebMessageInfo.toObject(m)))
	
	m.react = (u) => zhar.sendMessage(m.chat, { react: { text: u, key: m.key }})
	
	m.reply = async (content, options = {}) => {
		const { quoted = m, chat = m.chat, caption = '', ephemeralExpiration = m.expiration || m?.metadata?.ephemeralDuration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0, mentions = (typeof content === 'string' || typeof content.text === 'string' || typeof content.caption === 'string') ? [...(content.text || content.caption || content).matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net') : [], ...validate } = options;
		if (typeof content === 'object') {
			return zhar.sendMessage(chat, content, { ...options, quoted, ephemeralExpiration })
		} else if (typeof content === 'string') {
			try {
				if (/^https?:\/\//.test(content)) {
					const data = await axios.get(content, { responseType: 'arraybuffer' });
					const mime = data.headers['content-type'] || (await FileType.fromBuffer(data.data)).mime
					if (/gif|image|video|audio|pdf|stream/i.test(mime)) {
						return zhar.sendMedia(chat, data.data, '', caption, quoted, content)
					} else {
						return zhar.sendMessage(chat, { text: content, mentions, ...options }, { quoted, ephemeralExpiration })
					}
				} else {
					return zhar.sendMessage(chat, { text: content, mentions, ...options }, { quoted, ephemeralExpiration })
				}
			} catch (e) {
				return zhar.sendMessage(chat, { text: content, mentions, ...options }, { quoted, ephemeralExpiration })
			}
		}
	}

	return m
}

module.exports = { GroupUpdate, GroupParticipantsUpdate, LoadDataBase, MessagesUpsert, Solving }

let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(chalk.redBright(`Update ${__filename}`))
	delete require.cache[file]
	require(file)
});
