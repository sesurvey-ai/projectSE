import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config/api_config.dart';
import 'location_service.dart';

class SocketService {
  io.Socket? _socket;
  final LocationService _locationService = LocationService();

  void connect(String token) {
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
      // Connected to socket server
    });

    _socket!.onDisconnect((_) {
      // Disconnected from socket server
    });

    _socket!.on('request_location', (data) async {
      final position = await _locationService.getCurrentPosition();
      if (position != null) {
        final requestId = data is Map ? data['request_id'] ?? '' : '';
        _socket!.emit('location_response', {
          'request_id': requestId,
          'latitude': position.latitude,
          'longitude': position.longitude,
        });
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
