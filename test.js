const { Client, LocalAuth } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth(),
    pairWithPhoneNumber: {
        phoneNumber: '15195028015',
        showNotification: true
    }
});

client.on('code', (code) => {
    console.log(`CODE: ${code}`);
    process.exit(0);
});

client.on('qr', () => {
    console.log('QR CODE GENERATED');
    process.exit(1);
});

client.initialize();
