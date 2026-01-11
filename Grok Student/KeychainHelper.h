#import <Foundation/Foundation.h>

@interface KeychainHelper : NSObject

+ (BOOL)saveAPIKey:(NSString *)apiKey;
+ (NSString *)getAPIKey;
+ (BOOL)deleteAPIKey;

@end
