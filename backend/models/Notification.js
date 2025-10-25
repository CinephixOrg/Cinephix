// models/Notification.js (YENİ DOSYA - ES6 Modül Formatında)
import mongoose from 'mongoose';

const { Schema } = mongoose;

const notificationSchema = new Schema({
    // Bildirimi alan kullanıcı
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Eylemi başlatan kullanıcı (örn: sizi takip eden kişi)
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Bildirim tipi (gelecekte 'like', 'comment' gibi tipler de ekleyebilirsiniz)
    type: {
        type: String,
        enum: ['follow'], // Şimdilik sadece 'follow'
        required: true
    },
    // Bildirim okundu mu?
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true }); // Bildirimin ne zaman geldiğini bilmek için

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;