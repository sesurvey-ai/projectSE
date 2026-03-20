import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config/api_config.dart';
import 'location_service.dart';

class SocketService {
  io.Socket? _socket;
  final LocationService _locationService = LocationService();

  // Callback when a case is assigned to this surveyor
  void Function(Map<String, dynamic> data)? onCaseAssigned;

  void connect(String token) {
    debugPrint('[Socket] Connecting to ${ApiConfig.socketUrl}');
    _socket = io.io(
      ApiConfig.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );

    _socket!.connect();

    _socket!.onConnect((_) {
      debugPrint('[Socket] Connected! id=${_socket!.id}');
    });

    _socket!.onDisconnect((_) {
      debugPrint('[Socket] Disconnected');
    });

    _socket!.onConnectError((err) {
      debugPrint('[Socket] Connection error: $err');
    });

    _socket!.onError((err) {
      debugPrint('[Socket] Error: $err');
    });

    _socket!.on('case_assigned', (data) {
      debugPrint('[Socket] Received case_assigned: $data');
      if (data is Map<String, dynamic>) {
        onCaseAssigned?.call(data);
      } else if (data is Map) {
        onCaseAssigned?.call(Map<String, dynamic>.from(data));
      }
    });

    _socket!.on('request_location', (data) async {
      debugPrint('[Socket] Received request_location: $data');
      final position = await _locationService.getCurrentPosition();
      debugPrint('[Socket] GPS position: $position');
      if (position != null) {
        final requestId = data is Map ? data['request_id'] ?? '' : '';
        _socket!.emit('location_response', {
          'request_id': requestId,
          'latitude': position.latitude,
          'longitude': position.longitude,
        });
        debugPrint('[Socket] Sent location_response: ${position.latitude}, ${position.longitude}');
      } else {
        debugPrint('[Socket] GPS position is null - could not get location');
      }
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  bool get isConnected => _socket?.connected ?? false;
}
