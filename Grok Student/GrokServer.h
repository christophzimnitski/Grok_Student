#import <Foundation/Foundation.h>
#import <GCDWebServer/GCDWebServer.h>

@interface GrokServer : NSObject

@property (nonatomic, assign, readonly) NSInteger port;
@property (nonatomic, strong, readonly) GCDWebServer *webServer;
@property (nonatomic, copy) NSString *bonjourName;
@property (nonatomic, strong) NSString *selectedAPI;

- (BOOL)startServer;
- (void)stopServer;

- (void)clearHistory;

// Correct — only method, no property
- (NSString *)localIPAddress;

@end
