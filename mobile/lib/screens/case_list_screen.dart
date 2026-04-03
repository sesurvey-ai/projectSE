import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/case_provider.dart';
import '../widgets/case_card.dart';

class CaseListScreen extends StatefulWidget {
  const CaseListScreen({super.key});

  @override
  State<CaseListScreen> createState() => _CaseListScreenState();
}

class _CaseListScreenState extends State<CaseListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CaseProvider>().fetchMyCases();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // fetch ทุกครั้งที่หน้าแสดง
    context.read<CaseProvider>().fetchMyCases();
  }

  Future<void> _onRefresh() async {
    await context.read<CaseProvider>().fetchMyCases();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
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

          if (activeCases.isEmpty && declinedCases.isEmpty) {
            return Center(
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
            );
          }

          return RefreshIndicator(
            onRefresh: _onRefresh,
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
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
