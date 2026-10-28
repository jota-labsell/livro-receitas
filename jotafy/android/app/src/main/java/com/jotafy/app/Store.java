package com.jotafy.app;

import android.content.*;
import android.security.keystore.*;
import android.util.Base64;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.security.*;
import java.net.*;
import java.io.*;
import java.util.*;
import org.json.*;

final class Store {
 static android.content.SharedPreferences prefs(Context c) { return c.getSharedPreferences("jotafy",0); }
 static SecretKey key() throws Exception {
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
  if(!ks.containsAlias("jotafy")) {
   KeyGenerator g=KeyGenerator.getInstance("AES","AndroidKeyStore");
   g.init(new KeyGenParameterSpec.Builder("jotafy",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();
  }
  return (SecretKey)ks.getKey("jotafy",null);
 }
 static String secret(Context c) throws Exception {
  Cipher x=Cipher.getInstance("AES/GCM/NoPadding");x.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(prefs(c).getString("iv",""),0)));
  return new String(x.doFinal(Base64.decode(prefs(c).getString("secret",""),0)),"UTF-8");
 }
 static void save(Context c,String url,String token)throws Exception {
  URI u=new URI(url);
  if(!"https".equals(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null||u.getQuery()!=null||u.getFragment()!=null||!u.getPath().matches("/?"))
   throw new Exception("Use a URL HTTPS do monitor, sem caminho.");
  if(!token.matches("[a-fA-F0-9]{64}"))throw new Exception("A chave deve conter 64 caracteres hexadecimais.");
  Cipher x=Cipher.getInstance("AES/GCM/NoPadding");x.init(Cipher.ENCRYPT_MODE,key());
  boolean changed=!url.replaceAll("/$","").equals(prefs(c).getString("url",""));
  android.content.SharedPreferences.Editor edit=prefs(c).edit().putString("url",url.replaceAll("/$","")).putString("iv",Base64.encodeToString(x.getIV(),0)).putString("secret",Base64.encodeToString(x.doFinal(token.getBytes("UTF-8")),0)).remove("cursor");
  if(changed)edit.putString("installation_id",UUID.randomUUID().toString()).putBoolean("push_enabled",false).remove("last_dashboard");
  if(!edit.commit())throw new Exception("Não foi possível salvar a conexão.");
 }
 static String installation(Context c) {
  String value=prefs(c).getString("installation_id","");
  if(value.isEmpty()){value=UUID.randomUUID().toString();prefs(c).edit().putString("installation_id",value).commit();}
  return value;
 }
 static JSONObject request(Context c,String method,String path,JSONObject body)throws Exception {
  String url=prefs(c).getString("url","");
  if(url.isEmpty())throw new Exception("Conecte seu monitor para consultar as vendas.");
  HttpURLConnection h=(HttpURLConnection)new URL(url+path).openConnection();
  h.setInstanceFollowRedirects(false);h.setConnectTimeout(15000);h.setReadTimeout(15000);
  h.setRequestMethod(method);h.setRequestProperty("Authorization","Bearer "+secret(c));h.setRequestProperty("Accept","application/json");
  try {
   if(body!=null){h.setDoOutput(true);h.setRequestProperty("Content-Type","application/json");try(OutputStream out=h.getOutputStream()){out.write(body.toString().getBytes("UTF-8"));}}
   int status=h.getResponseCode();
   if(status!=200)throw new Exception(status==401?"Chave inválida. Confira sua conexão.":status==503?"Serviço temporariamente indisponível ou push não configurado.":status==404?"Recurso não disponível. Atualize a API do monitor.":"Não foi possível concluir (HTTP "+status+").");
   try(InputStream in=h.getInputStream();ByteArrayOutputStream b=new ByteArrayOutputStream()){
    byte[] data=new byte[4096];int n;while((n=in.read(data))!=-1){b.write(data,0,n);if(b.size()>1000000)throw new Exception("Resposta muito grande.");}
    return new JSONObject(b.toString("UTF-8"));
   }
  } finally {h.disconnect();}
 }
 static JSONObject load(Context c,int days,boolean events)throws Exception {return request(c,"GET","/dashboard?days="+days,null);}
 static JSONObject preferences(Context c)throws JSONException {
  JSONObject j=new JSONObject();String[] keys={"approved","pix_generated","rejected","refunded","charged_back","cancelled","sound","vibration","showValue"};
  for(String key:keys)j.put(key,prefs(c).getBoolean("pref_"+key,!key.equals("rejected")&&!key.equals("cancelled")));return j;
 }
 static String label(String s){
  switch(s){case "approved":return "Venda aprovada";case "pix_generated":return "Pix gerado";case "refunded":return "Reembolso";case "charged_back":return "Contestação";case "rejected":return "Pagamento recusado";case "cancelled":return "Pagamento cancelado";case "pix":return "Pix";case "credit_card":return "Cartão de crédito";case "debit_card":return "Cartão de débito";default:return "Não informado";}
 }
 static String money(long cents){return java.text.NumberFormat.getCurrencyInstance(new Locale("pt","BR")).format(cents/100.0);}
 static String time(long at,boolean date) {
  java.text.SimpleDateFormat f=new java.text.SimpleDateFormat(date?"dd/MM · HH:mm":"HH:mm",new Locale("pt","BR"));f.setTimeZone(TimeZone.getTimeZone("America/Sao_Paulo"));return f.format(new Date(at));
 }
}
