package com.helper;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Looper;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        try {
            // Initialize main looper if not already prepared to allow thread Handlers
            if (Looper.getMainLooper() == null) {
                Looper.prepareMainLooper();
            }
            
            Class<?> activityThreadClass = Class.forName("android.app.ActivityThread");
            Object thread = activityThreadClass.getMethod("systemMain").invoke(null);
            Context context = (Context) activityThreadClass.getMethod("getSystemContext").invoke(thread);
            
            PackageManager pm = context.getPackageManager();
            List<PackageInfo> list = pm.getInstalledPackages(0);
            for (PackageInfo pkg : list) {
                if (pkg.packageName != null && pkg.applicationInfo != null) {
                    CharSequence label = pm.getApplicationLabel(pkg.applicationInfo);
                    String appName = label != null ? label.toString().trim() : pkg.packageName;
                    appName = appName.replace('\n', ' ').replace('\r', ' ').replace('=', ' ');
                    System.out.println(pkg.packageName + "=" + appName);
                }
            }
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
        System.exit(0);
    }
}

