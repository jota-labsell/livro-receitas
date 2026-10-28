package com.jotafy.app;
import com.google.firebase.messaging.*;
public class PushService extends FirebaseMessagingService {
 @Override public void onNewToken(String token){PushRegistrar.register(this,token);}
 @Override public void onMessageReceived(RemoteMessage message){Notices.receive(this,message.getData());}
}
