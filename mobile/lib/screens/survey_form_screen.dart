import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../providers/case_provider.dart';

class SurveyFormScreen extends StatefulWidget {
  final int caseId;

  const SurveyFormScreen({super.key, required this.caseId});

  @override
  State<SurveyFormScreen> createState() => _SurveyFormScreenState();
}

class _SurveyFormScreenState extends State<SurveyFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _carModelController = TextEditingController();
  final _carColorController = TextEditingController();
  final _licensePlateController = TextEditingController();
  final _notesController = TextEditingController();
  final List<String> _photoPaths = [];
  final ImagePicker _picker = ImagePicker();

  @override
  void dispose() {
    _carModelController.dispose();
    _carColorController.dispose();
    _licensePlateController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _takePhoto() async {
    try {
      final XFile? photo = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 80,
        maxWidth: 1920,
      );
      if (photo != null) {
        setState(() {
          _photoPaths.add(photo.path);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ไม่สามารถเปิดกล้องได้')),
        );
      }
    }
  }

  void _removePhoto(int index) {
    setState(() {
      _photoPaths.removeAt(index);
    });
  }

  Future<void> _submitSurvey() async {
    if (!_formKey.currentState!.validate()) return;

    final data = {
      'car_model': _carModelController.text.trim(),
      'car_color': _carColorController.text.trim(),
      'license_plate': _licensePlateController.text.trim(),
      'notes': _notesController.text.trim(),
    };

    final caseProvider = context.read<CaseProvider>();
    final success =
        await caseProvider.submitSurvey(widget.caseId, data, _photoPaths);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('ส่งข้อมูลสำรวจสำเร็จ'),
          backgroundColor: Colors.green,
        ),
      );
      context.go('/cases');
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(caseProvider.error ?? 'เกิดข้อผิดพลาด'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('แบบฟอร์มสำรวจ'),
      ),
      body: Consumer<CaseProvider>(
        builder: (context, caseProvider, _) {
          return Stack(
            children: [
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Car model
                      TextFormField(
                        controller: _carModelController,
                        decoration: const InputDecoration(
                          labelText: 'รุ่นรถ',
                          prefixIcon: Icon(Icons.directions_car),
                          border: OutlineInputBorder(),
                        ),
                        textInputAction: TextInputAction.next,
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'กรุณากรอกรุ่นรถ';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),

                      // Car color
                      TextFormField(
                        controller: _carColorController,
                        decoration: const InputDecoration(
                          labelText: 'สีรถ',
                          prefixIcon: Icon(Icons.color_lens),
                          border: OutlineInputBorder(),
                        ),
                        textInputAction: TextInputAction.next,
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'กรุณากรอกสีรถ';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),

                      // License plate
                      TextFormField(
                        controller: _licensePlateController,
                        decoration: const InputDecoration(
                          labelText: 'ทะเบียน',
                          prefixIcon: Icon(Icons.confirmation_number),
                          border: OutlineInputBorder(),
                        ),
                        textInputAction: TextInputAction.next,
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'กรุณากรอกทะเบียน';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),

                      // Notes
                      TextFormField(
                        controller: _notesController,
                        decoration: const InputDecoration(
                          labelText: 'หมายเหตุ',
                          prefixIcon: Icon(Icons.note),
                          border: OutlineInputBorder(),
                          alignLabelWithHint: true,
                        ),
                        maxLines: 4,
                        textInputAction: TextInputAction.newline,
                      ),
                      const SizedBox(height: 24),

                      // Photos section
                      const Text(
                        'รูปถ่าย',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _buildPhotoGrid(),
                      const SizedBox(height: 24),

                      // Submit button
                      SizedBox(
                        height: 48,
                        child: ElevatedButton.icon(
                          onPressed:
                              caseProvider.isSubmitting ? null : _submitSurvey,
                          icon: const Icon(Icons.send),
                          label: const Text(
                            'ส่งข้อมูลสำรวจ',
                            style: TextStyle(fontSize: 16),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blue,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),

              // Loading overlay
              if (caseProvider.isSubmitting)
                Container(
                  color: Colors.black26,
                  child: const Center(
                    child: Card(
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CircularProgressIndicator(),
                            SizedBox(height: 16),
                            Text('กำลังส่งข้อมูล...'),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildPhotoGrid() {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: _photoPaths.length + 1,
      itemBuilder: (context, index) {
        if (index == _photoPaths.length) {
          // Add photo button
          return InkWell(
            onTap: _takePhoto,
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300, width: 2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.camera_alt, size: 32, color: Colors.grey),
                  SizedBox(height: 4),
                  Text(
                    'ถ่ายรูป',
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ],
              ),
            ),
          );
        }

        // Photo thumbnail
        return Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.file(
                File(_photoPaths[index]),
                fit: BoxFit.cover,
                width: double.infinity,
                height: double.infinity,
              ),
            ),
            Positioned(
              top: 4,
              right: 4,
              child: GestureDetector(
                onTap: () => _removePhoto(index),
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(
                    color: Colors.red,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.close,
                    size: 16,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
