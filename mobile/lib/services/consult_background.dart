import 'package:workmanager/workmanager.dart';
import 'consult_sync.dart';
import 'survey_queue.dart';

const String kConsultTask = 'se_consult_sync';

/// entry point ของ background isolate — ต้องเป็น top-level + @pragma
@pragma('vm:entry-point')
void consultCallbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    if (task != kConsultTask) return true;
    try {
      await runConsultSync();
      // piggyback: ส่งงานสำรวจที่ค้างในคิวออฟไลน์เมื่อมีเน็ต (task มี network constraint อยู่แล้ว)
      await flushSurveyQueue();
      return true;
    } catch (_) {
      return false; // ให้ WorkManager retry
    }
  });
}

class ConsultBackground {
  /// เรียกครั้งเดียวตอนแอป start (ใน main)
  static Future<void> init() async {
    await Workmanager().initialize(consultCallbackDispatcher);
  }

  /// ตั้ง periodic task — 15 นาที (เป็นค่าต่ำสุดที่ Android อนุญาตสำหรับ periodic)
  /// เรียกหลังล็อกอินสำเร็จ (เฉพาะ role surveyor)
  static Future<void> schedule() async {
    await Workmanager().registerPeriodicTask(
      kConsultTask,
      kConsultTask,
      frequency: const Duration(minutes: 15),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
      constraints: Constraints(networkType: NetworkType.connected),
      backoffPolicy: BackoffPolicy.linear,
      backoffPolicyDelay: const Duration(minutes: 2),
    );
  }

  static Future<void> cancel() async {
    await Workmanager().cancelByUniqueName(kConsultTask);
  }
}
