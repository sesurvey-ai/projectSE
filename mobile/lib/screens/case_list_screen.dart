import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/case_provider.dart';
import '../services/survey_queue.dart';
import '../widgets/case_card.dart';

class CaseListScreen extends StatefulWidget {
  const CaseListScreen({super.key});

  @override
  State<CaseListScreen> createState() => _CaseListScreenState();
}

class _CaseListScreenState extends State<CaseListScreen> {
  /// งานที่กรอกแล้วแต่ยังส่งไม่ถึงเซิร์ฟเวอร์ (ไม่มีเน็ต/เซิร์ฟเวอร์ล่ม) — ลองส่งเองอยู่
  int _queued = 0;
  /// งานที่ส่งไม่ผ่านแบบ **ลองใหม่เองไม่ได้** {caseId: เหตุผลจากเซิร์ฟเวอร์}
  /// (ข้อมูลไม่ผ่าน validation / เลขเซอร์เวย์ซ้ำ) — ต้องให้ช่างเปิดไปแก้เอง
  Map<int, String> _blocked = {};

  /// ⛔ ต้องมีอะไรบอกบนหน้าจอ — เดิมคิวทำงานเงียบสนิท ช่างกดส่งแล้วเห็นว่า "ส่งแล้ว"
  ///    ทั้งที่งานยังค้างอยู่ในเครื่อง ถ้าติด 400/409 จะค้างถาวรจนกว่าจะมีคนสังเกตเอง
  Future<void> _refreshQueueStatus() async {
    try {
      final q = await queuedSurveyCount();
      final b = await blockedSurveys();
      if (mounted) setState(() { _queued = q; _blocked = b; });
    } catch (_) {/* อ่านคิวไม่ได้ = ไม่ใช่เหตุให้หน้าจอพัง */}
  }

  @override
  void initState() {
    super.initState();
    // fetch ครั้งเดียวตอนเปิดหน้า — เดิมมีทั้ง postFrameCallback (initState) และ
    // didChangeDependencies (รันทันทีหลัง initState เสมอ) → ยิง GET /cases/my ซ้ำ 2 รอบทุกครั้ง
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CaseProvider>().fetchMyCases();
      _refreshQueueStatus();
    });
  }

  Future<void> _onRefresh() async {
    await context.read<CaseProvider>().fetchMyCases();
    // ดึงรีเฟรช = จังหวะที่มักมีเน็ตแล้ว → ลองส่งงานที่ค้างคิวไปด้วยเลย
    try { await flushSurveyQueue(); } catch (_) {}
    await _refreshQueueStatus();
  }

  /// แถบ "กำลังดูข้อมูลที่เก็บไว้" — ขึ้นเมื่อโหลดจากเซิร์ฟเวอร์ไม่ผ่านแล้วถอยไปใช้ cache
  ///
  /// ⛔ ต้องบอกให้ชัดว่าเป็นของเก่า + เก่าแค่ไหน ไม่งั้นช่างจะทำงานบนข้อมูลที่หัวหน้า
  ///    แก้ไปแล้ว (งานถูกยกเลิก/ย้ายคน) แล้วขับไปถึงที่เกิดเหตุฟรี
  Widget _offlineBanner(CaseProvider p) {
    if (!p.fromCache) return const SizedBox.shrink();
    final at = p.cachedAt;
    String age = '';
    if (at != null) {
      final m = DateTime.now().difference(at).inMinutes;
      age = m < 60 ? ' (อัปเดตล่าสุด $m นาทีที่แล้ว)' : ' (อัปเดตล่าสุด ${m ~/ 60} ชม.ที่แล้ว)';
    }
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.blueGrey.shade50,
        border: Border.all(color: Colors.blueGrey.shade200),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(children: [
        Icon(Icons.cloud_off, size: 20, color: Colors.blueGrey.shade600),
        const SizedBox(width: 8),
        Expanded(child: Text(
          'ต่อเน็ตไม่ได้ — กำลังดูข้อมูลที่เก็บไว้ในเครื่อง$age\nดึงหน้าจอลงเพื่อโหลดใหม่',
          style: TextStyle(fontSize: 13, color: Colors.blueGrey.shade800),
        )),
      ]),
    );
  }

  /// แถบสถานะคิว — ขึ้นเฉพาะตอนมีงานค้างจริง (ไม่มีอะไรค้าง = ไม่รบกวนสายตา)
  Widget _queueBanner() {
    if (_blocked.isEmpty && _queued == 0) return const SizedBox.shrink();
    final stuck = _blocked.isNotEmpty;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: stuck ? Colors.red.shade50 : Colors.amber.shade50,
        border: Border.all(color: stuck ? Colors.red.shade200 : Colors.amber.shade300),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(stuck ? Icons.error_outline : Icons.cloud_upload_outlined,
              size: 20, color: stuck ? Colors.red.shade700 : Colors.amber.shade800),
          const SizedBox(width: 8),
          Expanded(child: Text(
            stuck
                ? 'มีงาน ${_blocked.length} ใบส่งไม่ผ่าน ต้องแก้ก่อน'
                : 'มีงาน $_queued ใบรอส่ง (ยังไม่ถึงระบบ)',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5,
                color: stuck ? Colors.red.shade800 : Colors.amber.shade900),
          )),
        ]),
        const SizedBox(height: 4),
        if (stuck)
          // บอกเหตุผลจากเซิร์ฟเวอร์ตรง ๆ ช่างจะได้รู้ว่าต้องไปแก้อะไร
          ..._blocked.entries.map((e) => Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text('เคลม #${e.key}: ${e.value}',
                    style: TextStyle(fontSize: 12.5, color: Colors.red.shade800)),
              ))
        else
          Text('ระบบจะส่งให้เองเมื่อมีเน็ต — ดึงหน้าจอลงเพื่อลองส่งเดี๋ยวนี้',
              style: TextStyle(fontSize: 12.5, color: Colors.amber.shade900)),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'หน้าหลัก',
          onPressed: () => context.go('/home'),
        ),
        title: const Text('งานของฉัน'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'ออกจากระบบ',
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('ออกจากระบบ'),
                  content: const Text('คุณต้องการออกจากระบบหรือไม่?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      child: const Text('ยกเลิก'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      child: const Text('ออกจากระบบ'),
                    ),
                  ],
                ),
              );
              if (confirmed == true && context.mounted) {
                await context.read<AuthProvider>().logout();
              }
            },
          ),
        ],
      ),
      body: Consumer<CaseProvider>(
        builder: (context, caseProvider, _) {
          if (caseProvider.isLoading && caseProvider.cases.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (caseProvider.error != null && caseProvider.cases.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.grey),
                  const SizedBox(height: 16),
                  Text(
                    caseProvider.error!,
                    style: const TextStyle(color: Colors.grey, fontSize: 16),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _onRefresh,
                    child: const Text('ลองใหม่'),
                  ),
                ],
              ),
            );
          }

          final activeCases = caseProvider.cases.where((c) => c.status != 'declined').toList();
          final declinedCases = caseProvider.cases.where((c) => c.status == 'declined').toList();

          // ⛔ ไม่มีงานในรายการ ≠ ไม่มีงานค้าง — งานที่ส่งไม่ผ่านยังอยู่ในเครื่อง
          //    ถ้าโชว์แค่ "ไม่มีงาน" ช่างจะไม่มีวันรู้ว่ามีงานค้างที่ต้องแก้
          if (activeCases.isEmpty && declinedCases.isEmpty) {
            return ListView(children: [
              _offlineBanner(caseProvider),
              _queueBanner(),
              const SizedBox(height: 80),
              Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.inbox, size: 64, color: Colors.grey),
                  const SizedBox(height: 16),
                  const Text(
                    'ไม่มีงานที่ได้รับมอบหมาย',
                    style: TextStyle(color: Colors.grey, fontSize: 16),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _onRefresh,
                    child: const Text('รีเฟรช'),
                  ),
                ],
              ),
              ),
            ]);
          }

          return RefreshIndicator(
            onRefresh: _onRefresh,
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                _offlineBanner(caseProvider),
                _queueBanner(),
                // งานปกติ
                ...activeCases.map((caseItem) => CaseCard(
                  caseModel: caseItem,
                  onTap: () => context.go('/cases/${caseItem.id}'),
                )),
                // งานที่ปฏิเสธ
                if (declinedCases.isNotEmpty) ...[
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: Row(
                      children: [
                        Icon(Icons.cancel_outlined, size: 18, color: Colors.red),
                        SizedBox(width: 6),
                        Text('งานที่ปฏิเสธ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.red)),
                      ],
                    ),
                  ),
                  ...declinedCases.map((caseItem) => Opacity(
                    opacity: 0.6,
                    child: CaseCard(
                      caseModel: caseItem,
                      onTap: () => context.go('/cases/${caseItem.id}'),
                    ),
                  )),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}
