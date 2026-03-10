//
//  AppDelegate.mm
//  Grok Student
//

#import "AppDelegate.h"
#import "GrokServer.h"

@interface AppDelegate ()

@property (nonatomic, strong, readwrite) GrokServer *grokServer;

@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    self.grokServer = [[GrokServer alloc] init];
    BOOL started = [self.grokServer startServer];
    
    if (started) {
        NSLog(@"Grok Student server started successfully.");
    } else {
        NSLog(@"Failed to start Grok Student server.");
    }
    
    application.idleTimerDisabled = YES;
    
    return YES;
}

#pragma mark - UISceneSession lifecycle

- (UISceneConfiguration *)application:(UIApplication *)application configurationForConnectingSceneSession:(UISceneSession *)connectingSceneSession options:(UISceneConnectionOptions *)options {
    return [[UISceneConfiguration alloc] initWithName:@"Default Configuration" sessionRole:connectingSceneSession.role];
}

- (void)application:(UIApplication *)application didDiscardSceneSessions:(NSSet<UISceneSession *> *)sceneSessions {
    // Release resources specific to discarded scenes
}

#pragma mark - Application lifecycle

- (void)applicationWillTerminate:(UIApplication *)application {
    [self.grokServer stopServer];
    NSLog(@"Grok Student server stopped on app termination.");
}

@end
