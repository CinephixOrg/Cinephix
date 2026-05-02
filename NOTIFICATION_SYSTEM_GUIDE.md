# ✨ Bildirim Sistemi Implementasyonu - Tam Rehber

## 🎯 Neleri Yaptık?

Cinephix'e **tam bildirim sistemi** ekledik. Kullanıcılar artık:

### ✅ Mesaj Bildirimleri
- Biri sana mesaj yazdığında **Messages tabında kırmızı baloncuk** görünür
- Her konuşma için ayrı unread count
- Konuşmaya girince otomatik olarak sıfırlanır
- Real-time Socket.IO

### ✅ Takip Bildirimleri
- Birisi seni takip ettiğinde **bildirim alırsın**
- TopBar'daki bell icon'da **kırmızı badge** görünür
- Bildirimi tıkla → takip eden kullanıcının profiline git

### ✅ Genel Bildirim Paneli
- TopBar'daki **bell icon** - tüm bildirimleri göster
- Notification dropdown - son 20 bildirimleri hızlıca görüntüle
- `/notifications` sayfası - tüm bildirimleri paginated olarak gör

---

## 📁 Eklenen/Düzenlenen Dosyalar

### **BACKEND**

#### 1. **Models**
```
backend/models/Notification.js (UPDATED)
├─ type: 'follow' | 'message'
├─ user: recipient user ID
├─ sender: user ID who triggered the notification
├─ conversationId: for message notifications
└─ read: boolean flag
```

#### 2. **Controllers** 
```
backend/controllers/notificationController.js (NEW)
├─ getNotifications()         - GET with pagination
├─ getUnreadCount()           - GET total unread count
├─ getUnreadMessageCounts()   - GET unread per conversation
├─ markNotificationAsRead()   - PATCH single notification
├─ markAllAsRead()            - PATCH all notifications
├─ deleteNotification()       - DELETE single
└─ clearAllNotifications()    - DELETE all
```

#### 3. **Routes**
```
backend/routes/notificationRoute.js (NEW)
├─ GET    /api/notifications
├─ GET    /api/notifications/unread/count
├─ GET    /api/notifications/messages/unread
├─ PATCH  /api/notifications/:id/read
├─ PATCH  /api/notifications/mark-all-read
├─ DELETE /api/notifications/:id
└─ DELETE /api/notifications
```

#### 4. **Socket.IO**
```
backend/sockets/chatSocket.js (UPDATED)
├─ New event: 'new-notification' emitted to sender's inbox
│  └─ triggers when message sent in DM
├─ Auto-creates Notification document for messages
└─ Increments unread count in Conversation
```

#### 5. **User Controller**
```
backend/controllers/userController.js (ALREADY HAD)
├─ followUser()     - creates 'follow' type notification
└─ unfollowUser()   - deletes 'follow' type notification
```

#### 6. **Server**
```
backend/server.js (UPDATED)
└─ Added: app.use("/api/notifications", notificationRoute);
```

---

### **FRONTEND**

#### 1. **Context**
```
frontend/src/context/NotificationContext.jsx (NEW)
├─ notifications[]
├─ unreadCount
├─ messageUnreadCounts{} per conversation
├─ fetchNotifications()
├─ fetchUnreadCount()
├─ markAsRead()
├─ deleteNotification()
├─ markAllAsRead()
├─ incrementMessageUnread()
└─ clearConversationUnread()
```

#### 2. **API Service**
```
frontend/src/api/notificationService.js (UPDATED)
├─ getNotifications(page, limit)
├─ getUnreadCount()
├─ getUnreadMessageCounts()
├─ markAsRead(id)
├─ markAllAsRead()
├─ deleteNotification(id)
└─ clearAll()
```

#### 3. **Components**

**NotificationBell.jsx** (NEW)
```jsx
├─ Bell icon with red badge showing unreadCount
├─ Opens NotificationDropdown on click
└─ Real-time update
```

**NotificationDropdown.jsx** (NEW)
```jsx
├─ Shows last 20 notifications
├─ Follow → Shows user avatar + "X started following you"
├─ Message → Shows sender + "X sent you a message"
├─ Click to navigate or mark as read
├─ Delete button for each notification
└─ "Mark all as read" button
```

**TopBar.jsx** (UPDATED)
```jsx
├─ Imported NotificationContext
├─ Added <NotificationBell /> component
└─ Shows right next to user welcome message
```

**useChat.js** (UPDATED)
```javascript
├─ Listens to 'new-notification' Socket.IO event
├─ Increments messageUnreadCounts when msg received
└─ Real-time unread badges in DMPage
```

#### 4. **Pages**
```
frontend/src/pages/NotificationsPage.jsx (NEW)
├─ Shows all notifications with pagination
├─ Click notification → navigate or mark read
├─ Display unread count in header
├─ 💬 emoji for messages, 👤 for follows
└─ Delete individual notifications
```

#### 5. **App Routes** (UPDATED)
```jsx
├─ /notifications → NotificationsPage
└─ Protected route
```

#### 6. **main.jsx** (UPDATED)
```jsx
├─ Wrapped app with <NotificationProvider>
└─ Before RatingsProvider for priority
```

---

## 🔄 DATA FLOW

### **Mesaj Bildirimi Akışı**

```
1. User A sends message in DM
   ↓
2. Frontend emit: socket.emit('send-message', {...})
   ↓
3. Backend chatSocket.js receives event
   ↓
4. Create Message document + populate sender
   ↓
5. Broadcast to room: io.to(roomKey).emit('new-message', message)
   ↓
6. Create Notification document for other participant
   Notification {
     user: userB_id,
     sender: userA_id,
     type: 'message',
     conversationId: conversation_id,
     read: false
   }
   ↓
7. Emit to userB's inbox: io.to('user:userB_id').emit('new-notification', {...})
   ↓
8. Frontend useChat hook receives event:
   notificationContext.incrementMessageUnread(conversationId)
   ↓
9. Update DMPage unread badge in real-time
   ↓
10. User clicks conversation → markAsRead() → unread count = 0
```

### **Takip Bildirimi Akışı**

```
1. User A calls: POST /api/users/:userId/follow
   ↓
2. Backend followUser() in userController.js
   ↓
3. Update User.following and User.followers arrays
   ↓
4. Delete any existing follow notification
   ↓
5. Create new Notification:
   Notification {
     user: userB_id,
     sender: userA_id,
     type: 'follow',
     read: false
   }
   ↓
6. Frontend NotificationContext.fetchUnreadCount() runs periodically
   OR Real-time via Socket if we add follow event
   ↓
7. Bell icon shows red badge with unreadCount
   ↓
8. User clicks bell → NotificationBell shows dropdown
   ↓
9. Click notification → navigate to follower's profile
```

---

## 🎨 UI GÖSTERIM

### **TopBar (Bell Icon)**
```
┌─────────────────────────────────────────────────────┐
│ Logo  Movies Series Match Community Messages  🔔[2]  │
│                                          └─ Bell with badge
└─────────────────────────────────────────────────────┘
```

### **NotificationDropdown (Açılınca)**
```
┌──────────────────────────────┐
│ Notifications          (2)   │
│ [Mark all read button]       │
├──────────────────────────────┤
│ 👤 john_doe started ...   ● │  (● = unread dot)
│    Following you          │   │
│    5 minutes ago        [×] │
├──────────────────────────────┤
│ 💬 jane_smith sent you a ... │
│    message               ● │
│    10 minutes ago       [×] │
├──────────────────────────────┤
│ View all notifications →     │
└──────────────────────────────┘
```

### **Messages Tab (DMPage)**
```
┌─────────────────────────────────┐
│ Messages        [3] ⬆ unread   │
├─────────────────────────────────┤
│ [avatar] john_doe       5 min │
│ "Hey, how are you?"    [3] ◄── Red badge
├─────────────────────────────────┤
│ [avatar] jane_smith    20 min │
│ "See you tonight!"            │
└─────────────────────────────────┘
```

### **NotificationsPage**
```
Notifications
You have 3 unread notifications
[Mark all read]

┌────────────────────────────────────┐
│ 👤 john_doe started following you  │ ● (unread)
│    5 minutes ago              [×]  │
├────────────────────────────────────┤
│ 💬 jane_smith sent you a message   │
│    10 minutes ago             [×]  │
├────────────────────────────────────┤
│ 👤 mike_wilson started following   │
│    15 minutes ago             [×]  │
└────────────────────────────────────┘

[Previous]  Page 1  [Next]
```

---

## 🛠️ NASIL KULLANIRIZ?

### **Developers Açısından**

**1. Yeni notification type eklemek:**

Backend:
```javascript
// models/Notification.js
enum: ['follow', 'message', 'like', 'comment'] // Yeni type ekle

// notificationController.js
// Yeni handler yaz
```

Frontend:
```javascript
// NotificationDropdown.jsx
const getNotificationText = (notification) => {
  if (notification.type === 'like') {
    return `${notification.sender.username} liked your movie`;
  }
  // ...
}
```

**2. Real-time bildirimler almak:**

```javascript
// Hook'ta
const { unreadCount, notifications } = useContext(NotificationContext);

// Socket event dinlemek
useEffect(() => {
  socket.on('new-notification', (notif) => {
    // Veya incrementMessageUnread kullan
  });
}, []);
```

---

## ✅ KONTROL LİSTESİ

- [x] Notification model (follow + message types)
- [x] Notification controller (CRUD operations)
- [x] Notification routes
- [x] Socket.IO message notification
- [x] User follow notification (already existed)
- [x] NotificationContext
- [x] NotificationBell component
- [x] NotificationDropdown component
- [x] NotificationsPage
- [x] API service
- [x] useChat hook updates
- [x] DMPage unread badges (zaten var)
- [x] TopBar integration
- [x] App routes
- [x] main.jsx provider setup

---

## 🚀 KULLANMAYA BAŞLAMAK

**Test etmek için:**

1. Backend'i başlat: `npm run dev`
2. Frontend'i başlat: `npm run dev`
3. 2 account ile giriş yap
4. Birisiyle follow/unfollow yap → Bildirim alırsın
5. Mesaj gönder → Bell icon gösterir
6. `/notifications` sayfasına git → Tüm bildirimleri gör

---

## 🎯 BONUS FİKİRLER (İlerde yapılabilir)

- [ ] Push notifications (browser native)
- [ ] Email notifications
- [ ] Notification preferences (user settings)
- [ ] Like/comment notifications
- [ ] Group messages notifications
- [ ] Notification sounds
- [ ] Notification history/archive
- [ ] Notification filtering (by type)

