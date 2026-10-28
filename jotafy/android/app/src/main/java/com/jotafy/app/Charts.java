package com.jotafy.app;
import android.content.Context;
import android.graphics.*;
import android.view.View;
import org.json.*;
import java.util.Locale;

final class Charts extends View {
 final JSONArray data;final boolean donut;final Paint p=new Paint(3);
 static final int[] COLORS={0xff276454,0xff9DBC5D,0xffE4B877,0xff8A91B3,0xffD08971};
 Charts(Context c,JSONArray rows,boolean distribution){super(c);data=rows;donut=distribution;setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);setMinimumHeight(dp(distribution?160:210));StringBuilder a=new StringBuilder(distribution?"Vendas por forma de pagamento. ":"Vendas diárias. ");for(int i=0;i<rows.length();i++){JSONObject r=rows.optJSONObject(i);a.append(distribution?Store.label(r.optString("method")):r.optString("date")).append(": ").append(r.optInt("sales")).append(" vendas, ").append(Store.money(r.optLong("revenue"))).append(". ");}setContentDescription(a.toString());}
 int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
 void text(Canvas c,String text,float x,float y,int color,int sp){p.setColor(color);p.setStyle(Paint.Style.FILL);p.setTextSize(sp*getResources().getDisplayMetrics().scaledDensity);p.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));c.drawText(text,x,y,p);}
 @Override protected void onMeasure(int w,int h){super.onMeasure(w,h);setMeasuredDimension(getMeasuredWidth(),Math.max(dp(donut?170:220),dp((donut?150:180)*getResources().getConfiguration().fontScale)));}
 @Override protected void onDraw(Canvas c){super.onDraw(c);if(donut)ring(c);else series(c);}
 void ring(Canvas c){
  long total=0;for(int i=0;i<data.length();i++)total+=data.optJSONObject(i).optLong("sales");
  float cx=getWidth()/2f,cy=getHeight()/2f,r=Math.min(getHeight()/2f-dp(22),dp(68));
  p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(dp(18));p.setColor(0xffEBF0E8);c.drawCircle(cx,cy,r,p);
  if(total>0){float start=-90;RectF rect=new RectF(cx-r,cy-r,cx+r,cy+r);for(int i=0;i<data.length();i++){float sweep=360f*data.optJSONObject(i).optLong("sales")/total;p.setColor(COLORS[i%COLORS.length]);c.drawArc(rect,start+1,Math.max(0,sweep-2),false,p);start+=sweep;}}
  p.setStyle(Paint.Style.FILL);String value=String.valueOf(total);p.setTextSize(30*getResources().getDisplayMetrics().scaledDensity);p.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL));p.setColor(0xff102D2C);c.drawText(value,cx-p.measureText(value)/2,cy,p);p.setTextSize(12*getResources().getDisplayMetrics().scaledDensity);String label="vendas";c.drawText(label,cx-p.measureText(label)/2,cy+dp(24),p);
 }
 void series(Canvas c){
  long max=0,total=0;for(int i=0;i<data.length();i++){long v=data.optJSONObject(i).optLong("revenue");max=Math.max(max,v);total+=v;}
  if(total==0){text(c,"Nenhuma venda aprovada",dp(4),getHeight()/2f-dp(8),0xff52645F,15);text(c,"neste período.",dp(4),getHeight()/2f+dp(18),0xff52645F,14);return;}
  float left=dp(6),right=getWidth()-dp(8),top=dp(38),bottom=getHeight()-dp(38);
  text(c,Store.money(max),left,dp(22),0xff52645F,12);
  for(int i=0;i<3;i++){float y=top+(bottom-top)*i/2f;p.setColor(0xffE8EDE5);p.setStrokeWidth(dp(1));c.drawLine(left,y,right,y,p);}
  int n=data.length();Path path=new Path();float width=right-left;
  for(int i=0;i<n;i++){
   float x=n==1?(left+right)/2:left+i*width/(n-1);
   float y=bottom-(bottom-top)*data.optJSONObject(i).optLong("revenue")/Math.max(1,max);
   if(i==0)path.moveTo(x,y);else path.lineTo(x,y);
  }
  p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(dp(3));p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);p.setColor(0xff276454);c.drawPath(path,p);p.setStyle(Paint.Style.FILL);
  for(int i=0;i<n;i++){float x=n==1?(left+right)/2:left+i*width/(n-1),y=bottom-(bottom-top)*data.optJSONObject(i).optLong("revenue")/Math.max(1,max);if(n<10||data.optJSONObject(i).optLong("revenue")>0){p.setColor(0xff276454);c.drawCircle(x,y,dp(4),p);}}
  if(n>0){String first=data.optJSONObject(0).optString("date"),last=data.optJSONObject(n-1).optString("date");first=shortDate(first);last=shortDate(last);text(c,first,left,getHeight()-dp(10),0xff52645F,12);if(n>1){p.setTextSize(12*getResources().getDisplayMetrics().scaledDensity);text(c,last,right-p.measureText(last),getHeight()-dp(10),0xff52645F,12);}}
 }
 static String shortDate(String value){return value.length()>=10?value.substring(8,10)+"/"+value.substring(5,7):value;}
}
